"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createGithubClient } from "@/lib/github";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import amqp from "amqplib";

export async function updateFindingStatus(formData: FormData) {
  const findingId = formData.get("findingId") as string;
  const status = formData.get("status") as string;

  const supabase = createServerSupabaseClient();

  const updates: Record<string, unknown> = { status };
  if (status === "revoked" || status === "false_positive") {
    updates.resolved_at = new Date().toISOString();
  }

  await supabase.from("findings").update(updates).eq("id", findingId);

  revalidatePath("/");
}

export async function logout() {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function connectRepo(formData: FormData) {
  const repoFullName = formData.get("repoFullName") as string;
  const defaultBranch = formData.get("defaultBranch") as string;

  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const supabase = createServerSupabaseClient();

  const { data: tokenRow } = await supabase
    .from("user_provider_tokens")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) throw new Error("No se encontró el token de GitHub");

  const plainToken = decryptToken(tokenRow.access_token);

  const [owner, repo] = repoFullName.split("/");
  const octokit = createGithubClient(plainToken);
  const webhookSecret = crypto.randomBytes(24).toString("hex");
  const webhookReceiverUrl = process.env.WEBHOOK_RECEIVER_PUBLIC_URL;

  if (!webhookReceiverUrl) {
    throw new Error("WEBHOOK_RECEIVER_PUBLIC_URL no está configurado");
  }

  const { data: hook } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: `${webhookReceiverUrl}/webhooks/github`,
      content_type: "json",
      secret: webhookSecret,
    },
    events: ["push"],
  });

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

  await supabase.from("connected_repos").insert({
    user_id: user.id,
    provider: "github",
    provider_repo_id: String(repoData.id),
    full_name: repoFullName,
    default_branch: defaultBranch,
    webhook_id: String(hook.id),
    webhook_secret: webhookSecret,
    access_token: encryptToken(plainToken),
  });

  revalidatePath("/");
  revalidatePath("/connect");
}

export async function triggerManualScan(formData: FormData) {
  const repoId = formData.get("repoId") as string;
  const repoFullName = formData.get("repoFullName") as string;

  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const supabase = createServerSupabaseClient();

  const { data: tokenRow } = await supabase
    .from("user_provider_tokens")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) throw new Error("No se encontró el token de GitHub");

  const plainToken = decryptToken(tokenRow.access_token);

  const { data: repoRow } = await supabase
    .from("connected_repos")
    .select("default_branch")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  if (!repoRow) throw new Error("Repositorio no encontrado");

  const [owner, repo] = repoFullName.split("/");
  const octokit = createGithubClient(plainToken);
  const { data: branchData } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: repoRow.default_branch,
  });
  const latestCommitSha = branchData.commit.sha;

  const { data: scan } = await supabase
    .from("scans")
    .insert({
      repo_id: repoId,
      user_id: user.id,
      trigger_type: "manual",
      status: "pending",
    })
    .select("id")
    .single();

  if (!scan) throw new Error("No se pudo crear el escaneo");

  const connection = await amqp.connect(process.env.CLOUDAMQP_URL!);
  const channel = await connection.createChannel();
  await channel.assertExchange("secretscan_events", "topic", {
    durable: true,
  });

  channel.publish(
    "secretscan_events",
    "scan.requested",
    Buffer.from(
      JSON.stringify({
        provider: "github",
        repoFullName,
        repoId,
        userId: user.id,
        scanId: scan.id,
        commitSha: latestCommitSha,
        branch: repoRow.default_branch,
        scanMode: "full",
        requestedAt: new Date().toISOString(),
      })
    ),
    { persistent: true, contentType: "application/json" }
  );

  await channel.close();
  await connection.close();

  revalidatePath("/");
}