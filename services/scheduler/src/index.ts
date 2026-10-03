import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { Octokit } from "octokit";
import amqp from "amqplib";
import { decryptToken } from "./crypto.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: repos, error } = await supabase
    .from("connected_repos")
    .select("id, user_id, full_name, default_branch")
    .eq("is_active", true);

  if (error || !repos) {
    console.error("Error obteniendo repos:", error);
    process.exit(1);
  }

  console.log(`Encolando escaneo diario para ${repos.length} repos`);

  const connection = await amqp.connect(process.env.CLOUDAMQP_URL!);
  const channel = await connection.createChannel();
  await channel.assertExchange("secretscan_events", "topic", {
    durable: true,
  });

  for (const repo of repos) {
    try {
      const { data: tokenRow } = await supabase
        .from("user_provider_tokens")
        .select("access_token")
        .eq("user_id", repo.user_id)
        .single();

      if (!tokenRow) {
        console.error(
          `Sin token de GitHub para el usuario de ${repo.full_name}`
        );
        continue;
      }

      const octokit = new Octokit({
        auth: decryptToken(tokenRow.access_token),
      });
      const [owner, name] = repo.full_name.split("/");
      const { data: branch } = await octokit.rest.repos.getBranch({
        owner,
        repo: name,
        branch: repo.default_branch,
      });

      const { data: scan } = await supabase
        .from("scans")
        .insert({
          repo_id: repo.id,
          user_id: repo.user_id,
          trigger_type: "scheduled",
          status: "pending",
        })
        .select("id")
        .single();

      if (!scan) continue;

      channel.publish(
        "secretscan_events",
        "scan.requested",
        Buffer.from(
          JSON.stringify({
            provider: "github",
            repoFullName: repo.full_name,
            repoId: repo.id,
            userId: repo.user_id,
            scanId: scan.id,
            commitSha: branch.commit.sha,
            branch: repo.default_branch,
            scanMode: "full",
            requestedAt: new Date().toISOString(),
          })
        ),
        { persistent: true, contentType: "application/json" }
      );

      console.log(`Encolado: ${repo.full_name}`);
    } catch (err) {
      console.error(`Error con ${repo.full_name}:`, err);
    }
  }

  await channel.close();
  await connection.close();
  console.log("Scheduler completado");
  process.exit(0);
}

run();