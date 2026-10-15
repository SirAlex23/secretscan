import { supabase } from "./supabaseClient.js";

export interface RepoCandidate {
  id: string;
  user_id: string;
  webhook_secret: string;
}

export interface RepoAndScan {
  repoId: string;
  userId: string;
  scanId: string;
}

export async function findRepoCandidates(
  provider: "github" | "gitlab",
  repoFullName: string
): Promise<RepoCandidate[]> {
  const { data, error } = await supabase
    .from("connected_repos")
    .select("id, user_id, webhook_secret")
    .eq("provider", provider)
    .eq("full_name", repoFullName)
    .eq("is_active", true);

  if (error) {
    console.error("Error buscando el repo:", error);
    return [];
  }

  return data ?? [];
}

export async function createScan(repo: {
  id: string;
  user_id: string;
}): Promise<RepoAndScan | null> {
  const { data: scan, error } = await supabase
    .from("scans")
    .insert({
      repo_id: repo.id,
      user_id: repo.user_id,
      trigger_type: "webhook",
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !scan) {
    console.error("Error creando el scan:", error);
    return null;
  }

  return { repoId: repo.id, userId: repo.user_id, scanId: scan.id };
}

// Se mantiene para el endpoint de GitLab
export async function findRepoAndCreateScan(
  provider: "github" | "gitlab",
  repoFullName: string
): Promise<RepoAndScan | null> {
  const [repo] = await findRepoCandidates(provider, repoFullName);

  if (!repo) {
    console.log(`Repo no conectado en SecretScan: ${repoFullName}`);
    return null;
  }

  return createScan(repo);
}