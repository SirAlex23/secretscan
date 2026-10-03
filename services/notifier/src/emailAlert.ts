import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface AlertData {
  secretType: string;
  filePath: string;
  snippetObfuscated: string;
  severity: string;
  confidence: number;
  reasoning: string;
  repoFullName?: string;
  commitSha: string;
}

export async function sendEmailAlert(data: AlertData) {
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;

  if (!to || !from) {
    console.error("Faltan ALERT_EMAIL_TO o ALERT_EMAIL_FROM en el .env");
    return;
  }

  try {
    await resend.emails.send({
      from,
      to,
      subject: `🚨 SecretScan: secreto detectado (${data.severity})`,
      html: `
        <h2>Se ha detectado un posible secreto filtrado</h2>
        <p><strong>Tipo:</strong> ${data.secretType}</p>
        <p><strong>Archivo:</strong> ${data.filePath}</p>
        <p><strong>Snippet:</strong> <code>${data.snippetObfuscated}</code></p>
        <p><strong>Severidad:</strong> ${data.severity}</p>
        <p><strong>Confianza (IA):</strong> ${Math.round(data.confidence * 100)}%</p>
        <p><strong>Razonamiento:</strong> ${data.reasoning}</p>
        <p><strong>Commit:</strong> ${data.commitSha}</p>
        <hr />
        <p>Revisa este hallazgo en tu dashboard de SecretScan lo antes posible.</p>
      `,
    });

    console.log("Email de alerta enviado a", to);
  } catch (err) {
    console.error("Error enviando email:", err);
  }
}