import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const connection = await amqp.connect(process.env.CLOUDAMQP_URL);
const channel = await connection.createChannel();

await channel.assertExchange("secretscan_events", "topic", { durable: true });

const event = {
  provider: "github",
  repoFullName: "SirAlex23/pulseboard",
  repoProviderId: "999999", // no importa para esta prueba
  commitSha: "162cdc12ca2e71101095cc76254410e67707b8dd",
  branch: "main",
  pusherName: "SirAlex23",
  requestedAt: new Date().toISOString(),
};

channel.publish(
  "secretscan_events",
  "scan.requested",
  Buffer.from(JSON.stringify(event)),
  { persistent: true, contentType: "application/json" }
);

console.log("Evento scan.requested publicado con SHA real:", event.commitSha);

await channel.close();
await connection.close();