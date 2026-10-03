import amqp from "amqplib";

interface ScanRequestedEvent {
  provider: "github" | "gitlab";
  repoFullName: string;
  repoId: string;
  userId: string;
  scanId: string;
  commitSha: string;
  branch: string;
  pusherName?: string;
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

export async function publishScanRequested(event: ScanRequestedEvent) {
  const ch = await getChannel();

  const message = {
    ...event,
    requestedAt: new Date().toISOString(),
  };

  ch.publish(
    "secretscan_events",
    "scan.requested",
    Buffer.from(JSON.stringify(message)),
    { persistent: true, contentType: "application/json" }
  );

  console.log("Evento scan.requested publicado:", message);
}