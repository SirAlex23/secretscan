import "./env.js";
import express from "express";
import amqp from "amqplib";
import { sendEmailAlert } from "./emailAlert.js";
import { sendSlackAlert } from "./slackAlert.js";

const PORT = process.env.PORT || 4004;

interface FindingConfirmedEvent {
  findingId: string;
  secretType: string;
  filePath: string;
  snippetObfuscated: string;
  severity: string;
  confidence: number;
  reasoning: string;
  scanId: string;
  repoId: string;
  userId: string;
  commitSha: string;
}

async function processConfirmedFinding(event: FindingConfirmedEvent) {
  console.log("Enviando alertas para:", event.secretType, event.filePath);

  await Promise.all([sendEmailAlert(event), sendSlackAlert(event)]);
}

async function startConsumer() {
  const url = process.env.CLOUDAMQP_URL;
  if (!url) throw new Error("CLOUDAMQP_URL no está configurado");

  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange("secretscan_events", "topic", {
    durable: true,
  });
  await channel.assertQueue("q.confirmed_findings", { durable: true });

  channel.prefetch(1);

  console.log("Notifier esperando mensajes en q.confirmed_findings...");

  channel.consume("q.confirmed_findings", async (msg) => {
    if (!msg) return;

    try {
      const event: FindingConfirmedEvent = JSON.parse(msg.content.toString());
      await processConfirmedFinding(event);
      channel.ack(msg);
    } catch (err) {
      console.error("Error procesando mensaje:", err);
      channel.nack(msg, false, false);
    }
  });
}

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "notifier" });
});

app.listen(PORT, () => {
  console.log(`notifier escuchando en el puerto ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("Error iniciando el consumidor:", err);
  process.exit(1);
});