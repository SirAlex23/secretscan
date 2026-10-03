import { supabase } from "./supabaseClient.js";

export interface RepoAndScan {
  repoId: string;
  userId: string;
  scanId: string;
}

export async function findRepoAndCreateScan(
  provider: "github" | "gitlab",
  repoFullName: string
): Promise<RepoAndScan | null> {
  // 1. Buscar el repo conectado por proveedor + nombre completo
  const { data: repo, error: repoError } = await supabase
    .from("connected_repos")
    .select("id, user_id")
    .eq("provider", provider)
    .eq("full_name", repoFullName)
    .eq("is_active", true)
    .maybeSingle();

  if (repoError) {
    console.error("Error buscando el repo:", repoError);
    return null;
  }

  if (!repo) {
    console.log(`Repo no conectado en SecretScan: ${repoFullName}`);
    return null;
  }

  // 2. Crear la fila de escaneo
  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({
      repo_id: repo.id,
      user_id: repo.user_id,
      trigger_type: "webhook",
      status: "pending",
    })
    .select("id")
    .single();

  if (scanError || !scan) {
    console.error("Error creando el scan:", scanError);
    return null;
  }

  return {
    repoId: repo.id,
    userId: repo.user_id,
    scanId: scan.id,
  };
}