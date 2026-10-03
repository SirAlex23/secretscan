import "./env.js";
import express from "express";
import amqp from "amqplib";
import { getChangedFilesContent } from "./githubDiff.js";
import { getAllFilesContent } from "./githubFullScan.js";
import { scanContent } from "./scanEngine.js";
import { publishFindingRaw } from "./publisher.js";
import { saveFinding, updateScanStatus } from "./findingsRepository.js";

const PORT = process.env.PORT || 4002;

interface ScanRequestedEvent {
  provider: "github" | "gitlab";
  repoFullName: string;
  repoId: string;
  userId: string;
  scanId: string;
  commitSha: string;
  branch: string;
  pusherName?: string;
  requestedAt: string;
  scanMode?: "incremental" | "full";
}

async function processScanRequest(event: ScanRequestedEvent) {
  console.log(
    "Procesando escaneo:",
    event.repoFullName,
    event.commitSha,
    "modo:",
    event.scanMode ?? "incremental"
  );

  if (event.provider !== "github") {
    console.log("Proveedor no soportado aún:", event.provider);
    return;
  }

  await updateScanStatus(event.scanId, "running");

  try {
    const filesToScan =
      event.scanMode === "full"
        ? await getAllFilesContent(event.repoFullName, event.commitSha)
        : (
            await getChangedFilesContent(event.repoFullName, event.commitSha)
          ).map((f) => ({ filePath: f.filePath, content: f.addedContent }));

    console.log(`Archivos a escanear: ${filesToScan.length}`);

    let totalFindings = 0;

    for (const file of filesToScan) {
      const findings = scanContent(file.filePath, file.content);

      for (const finding of findings) {
        totalFindings++;

        const findingId = await saveFinding({
          ...finding,
          scanId: event.scanId,
          repoId: event.repoId,
          userId: event.userId,
          commitSha: event.commitSha,
        });

        if (findingId) {
          await publishFindingRaw({
            ...finding,
            findingId,
            scanId: event.scanId,
            repoId: event.repoId,
            userId: event.userId,
            commitSha: event.commitSha,
          });
        }
      }
    }

    await updateScanStatus(event.scanId, "completed");
    console.log(`Escaneo completado. Hallazgos encontrados: ${totalFindings}`);
  } catch (err) {
    await updateScanStatus(event.scanId, "failed");
    throw err;
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
  await channel.assertQueue("q.scan_requests", { durable: true });

  channel.prefetch(1);

  console.log("Scanner esperando mensajes en q.scan_requests...");

  channel.consume("q.scan_requests", async (msg) => {
    if (!msg) return;

    try {
      const event: ScanRequestedEvent = JSON.parse(msg.content.toString());
      await processScanRequest(event);
      channel.ack(msg);
    } catch (err) {
      console.error("Error procesando mensaje:", err);
      channel.nack(msg, false, false);
    }
  });
}

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "scanner" });
});

app.listen(PORT, () => {
  console.log(`scanner escuchando en el puerto ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("Error iniciando el consumidor:", err);
  process.exit(1);
});