import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface TriageInput {
  secretType: string;
  filePath: string;
  snippetObfuscated: string;
  severity: string;
}

interface TriageResult {
  confidence: number; // 0 a 1
  reasoning: string;
}

const SYSTEM_PROMPT = `Eres un analista de seguridad experto en detectar secretos filtrados en código fuente (API keys, tokens, credenciales).

Tu tarea es evaluar si un hallazgo detectado por un scanner automático es un secreto REAL y ACTIVO, o un falso positivo.

Señales de FALSO POSITIVO (baja confianza, 0.0-0.3):
- La ruta del archivo contiene "test", "spec", "example", ".env.example"
- El secreto parece un placeholder o valor de ejemplo conocido (ej. "AKIAIOSFODNN7EXAMPLE" es el ejemplo oficial de AWS)
- El contexto sugiere que es documentación o un mock

Señales de SECRETO REAL (alta confianza, 0.7-1.0):
- El archivo parece código de producción (no test, no ejemplo)
- El formato del secreto coincide exactamente con el patrón esperado del proveedor
- No hay indicios de que sea un placeholder

Responde ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown, con este formato exacto:
{"confidence": 0.0, "reasoning": "explicación breve en una frase"}`;

export async function triageFinding(
  input: TriageInput
): Promise<TriageResult> {
  const userPrompt = `Tipo de secreto: ${input.secretType}
Archivo: ${input.filePath}
Snippet (ofuscado): ${input.snippetObfuscated}
Severidad asignada por el scanner: ${input.severity}

Evalúa este hallazgo.`;

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const rawResponse = completion.choices[0]?.message?.content;

  if (!rawResponse) {
    throw new Error("Groq no devolvió respuesta");
  }

  const parsed = JSON.parse(rawResponse);

  return {
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence))),
    reasoning: String(parsed.reasoning ?? "Sin explicación"),
  };
}