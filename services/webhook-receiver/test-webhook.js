import crypto from "node:crypto";

const secret = "un_secreto_que_tu_elijas"; // debe coincidir EXACTO con GITHUB_WEBHOOK_SECRET de tu .env

const payload = {
  ref: "refs/heads/main",
  after: "162cdc12ca2e71101095cc76254410e67707b8dd",
  repository: {
    id: 123456,
    full_name: "SirAlex23/pulseboard",
  },
  pusher: {
    name: "SirAlex23",
  },
};

const body = JSON.stringify(payload);
const signature =
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

const response = await fetch("http://localhost:4001/webhooks/github", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Hub-Signature-256": signature,
    "X-GitHub-Event": "push",
  },
  body,
});

const data = await response.json();
console.log("Respuesta:", response.status, data);