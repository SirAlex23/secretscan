import "./env.js";
import express from "express";
import amqp from "amqplib";
import { triageFinding } from "./groqTriage.js";
import { updateFindingConfidence } from "./findingsRepository.js";
import { publishFindingConfirmed } from "./publisher.js";

const PORT = process.env.PORT || 4003;

// Umbral a partir del cual consideramos que hay que alertar
const CONFIDENCE_THRESHOLD = 0.7;

interface FindingRawEvent {
  findingId: string;
  secretType: string;
  filePath: string;
  lineNumber: number;
  snippetObfuscated: string;
  severity: "low" | "medium" | "high" | "critical";
  scanId: string;
  repoId: string;
  userId: string;
  commitSha: string;
}

async function processRawFinding(event: FindingRawEvent) {
  console.log("Triando hallazgo:", event.secretType, event.filePath);

  const result = await triageFinding({
    secretType: event.secretType,
    filePath: event.filePath,
    snippetObfuscated: event.snippetObfuscated,
    severity: event.severity,
  });

  console.log(
    `Confianza calculada: ${result.confidence} — ${result.reasoning}`
  );

  await updateFindingConfidence(event.findingId, result.confidence);

  if (result.confidence >= CONFIDENCE_THRESHOLD) {
    await publishFindingConfirmed({
      findingId: event.findingId,
      secretType: event.secretType,
      filePath: event.filePath,
      snippetObfuscated: event.snippetObfuscated,
      severity: event.severity,
      confidence: result.confidence,
      reasoning: result.reasoning,
      scanId: event.scanId,
      repoId: event.repoId,
      userId: event.userId,
      commitSha: event.commitSha,
    });
  } else {
    console.log("Confianza por debajo del umbral, no se genera alerta.");
  }
}

async function startConsumer() {
  const url = process.env.CLOUDAMQP_URL;
  if (!url) throw new Error("CLOUDAMQP_URL no está configurado");

  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange("secretscan_events", "topic", {
    durable: true,
  });
  await channel.assertQueue("q.raw_findings", { durable: true });

  channel.prefetch(1);

  console.log("Triager esperando mensajes en q.raw_findings...");

  channel.consume("q.raw_findings", async (msg) => {
    if (!msg) return;

    try {
      const event: FindingRawEvent = JSON.parse(msg.content.toString());
      await processRawFinding(event);
      channel.ack(msg);
    } catch (err) {
      console.error("Error procesando mensaje:", err);
      channel.nack(msg, false, false);
    }
  });
}

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "triager" });
});

app.listen(PORT, () => {
  console.log(`triager escuchando en el puerto ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("Error iniciando el consumidor:", err);
  process.exit(1);
});