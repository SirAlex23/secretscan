interface AlertData {
    secretType: string;
    filePath: string;
    snippetObfuscated: string;
    severity: string;
    confidence: number;
    reasoning: string;
    commitSha: string;
  }
  
  export async function sendSlackAlert(data: AlertData) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
    if (!webhookUrl) {
      console.error("Falta SLACK_WEBHOOK_URL en el .env");
      return;
    }
  
    const message = {
      text: `🚨 *SecretScan: secreto detectado*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🚨 Secreto detectado (${data.severity})*\n*Tipo:* ${data.secretType}\n*Archivo:* \`${data.filePath}\`\n*Snippet:* \`${data.snippetObfuscated}\`\n*Confianza (IA):* ${Math.round(data.confidence * 100)}%\n*Razonamiento:* ${data.reasoning}\n*Commit:* \`${data.commitSha}\``,
          },
        },
      ],
    };
  
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
  
      if (!response.ok) {
        console.error("Error enviando a Slack:", response.status);
      } else {
        console.log("Alerta enviada a Slack");
      }
    } catch (err) {
      console.error("Error enviando a Slack:", err);
    }
  }