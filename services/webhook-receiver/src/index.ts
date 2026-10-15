import "./env.js";
import express from "express";
import { verifyGithubSignature } from "./verifySignature.js";
import { publishScanRequested } from "./publisher.js";
import {
  findRepoCandidates,
  createScan,
  findRepoAndCreateScan,
} from "./repoLookup.js";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "webhook-receiver" });
});

app.post("/webhooks/github", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const event = req.headers["x-github-event"] as string | undefined;
  const rawBody = (req as any).rawBody as Buffer;

  if (!signature) {
    return res.status(401).json({ error: "Falta la firma del webhook" });
  }

  // GitHub envía un "ping" al crear el webhook; solo actuamos con push
  if (event !== "push") {
    return res.status(200).json({ message: `Evento ${event} ignorado` });
  }

  const payload = req.body;
  const repoFullName = payload?.repository?.full_name;

  if (!repoFullName) {
    return res.status(400).json({ error: "Payload sin repositorio" });
  }

  // El secreto es distinto por repo: buscamos el que valide la firma
  const candidates = await findRepoCandidates("github", repoFullName);
  const matched = candidates.find((c) =>
    verifyGithubSignature(rawBody, signature, c.webhook_secret)
  );

  if (!matched) {
    console.log(
      `Firma no válida o repo no conectado: ${repoFullName} (${candidates.length} candidatos)`
    );
    return res.status(401).json({ error: "Firma inválida" });
  }

  // Un push que borra una rama no tiene nada que escanear
  if (payload.deleted) {
    return res.status(200).json({ message: "Push de borrado ignorado" });
  }

  const repoAndScan = await createScan(matched);

  if (!repoAndScan) {
    return res.status(500).json({ error: "No se pudo crear el escaneo" });
  }

  try {
    await publishScanRequested({
      provider: "github",
      repoFullName,
      repoId: repoAndScan.repoId,
      userId: repoAndScan.userId,
      scanId: repoAndScan.scanId,
      commitSha: payload.after,
      branch: payload.ref.replace("refs/heads/", ""),
      pusherName: payload.pusher?.name,
    });

    return res.status(200).json({ message: "Evento de escaneo publicado" });
  } catch (err) {
    console.error("Error publicando evento:", err);
    return res.status(500).json({ error: "Error interno al publicar el evento" });
  }
});

app.post("/webhooks/gitlab", async (req, res) => {
  const token = req.headers["x-gitlab-token"] as string | undefined;

  if (!token || token !== process.env.GITLAB_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const payload = req.body;

  if (payload.object_kind !== "push") {
    return res.status(200).json({ message: "Evento ignorado" });
  }

  const repoFullName = payload.project.path_with_namespace;
  const repoAndScan = await findRepoAndCreateScan("gitlab", repoFullName);

  if (!repoAndScan) {
    return res.status(200).json({
      message: `Repo ${repoFullName} no está conectado en SecretScan, evento ignorado`,
    });
  }

  try {
    await publishScanRequested({
      provider: "gitlab",
      repoFullName,
      repoId: repoAndScan.repoId,
      userId: repoAndScan.userId,
      scanId: repoAndScan.scanId,
      commitSha: payload.after,
      branch: payload.ref.replace("refs/heads/", ""),
      pusherName: payload.user_name,
    });

    return res.status(200).json({ message: "Evento de escaneo publicado" });
  } catch (err) {
    console.error("Error publicando evento:", err);
    return res.status(500).json({ error: "Error interno al publicar el evento" });
  }
});

app.listen(PORT, () => {
  console.log(`webhook-receiver escuchando en el puerto ${PORT}`);
});