import { supabase } from "./supabaseClient.js";
import type { RawFinding } from "./scanEngine.js";

interface SaveFindingParams extends RawFinding {
  scanId: string;
  repoId: string;
  userId: string;
  commitSha: string;
}

export async function saveFinding(
  params: SaveFindingParams
): Promise<string | null> {
  const { data, error } = await supabase
    .from("findings")
    .insert({
      scan_id: params.scanId,
      repo_id: params.repoId,
      user_id: params.userId,
      secret_type: params.secretType,
      file_path: params.filePath,
      line_number: params.lineNumber,
      snippet_obfuscated: params.snippetObfuscated,
      commit_sha: params.commitSha,
      severity: params.severity,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error guardando finding:", error);
    return null;
  }

  return data.id;
}

export async function updateScanStatus(
  scanId: string,
  status: "running" | "completed" | "failed"
) {
  const updates: Record<string, unknown> = { status };

  if (status === "completed" || status === "failed") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase.from("scans").update(updates).eq("id", scanId);

  if (error) {
    console.error("Error actualizando estado del scan:", error);
  }
}