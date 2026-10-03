import { supabase } from "./supabaseClient.js";

export async function updateFindingConfidence(
  findingId: string,
  confidence: number
) {
  const { error } = await supabase
    .from("findings")
    .update({ confidence_score: confidence })
    .eq("id", findingId);

  if (error) {
    console.error("Error actualizando confidence del finding:", error);
  }
}