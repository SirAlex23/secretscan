import amqp from "amqplib";

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

let channel: amqp.Channel | null = null;

async function getChannel(): Promise<amqp.Channel> {
  if (channel) return channel;

  const url = process.env.CLOUDAMQP_URL;
  if (!url) {
    throw new Error("CLOUDAMQP_URL no está configurado");
  }

  const connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange("secretscan_events", "topic", {
    durable: true,
  });

  return channel;
}

export async function publishFindingConfirmed(event: FindingConfirmedEvent) {
  const ch = await getChannel();

  ch.publish(
    "secretscan_events",
    "finding.confirmed",
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: "application/json" }
  );

  console.log(
    "Evento finding.confirmed publicado:",
    event.secretType,
    event.filePath,
    "confianza:",
    event.confidence
  );
}