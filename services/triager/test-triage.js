import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const connection = await amqp.connect(process.env.CLOUDAMQP_URL);
const channel = await connection.createChannel();

await channel.assertExchange("secretscan_events", "topic", { durable: true });

const event = {
  findingId: "00000000-0000-0000-0000-000000000000", // ID ficticio, la actualización en Supabase fallará silenciosamente pero podrás ver el resto del flujo
  secretType: "aws_access_key",
  filePath: "src/config/production.ts",
  snippetObfuscated: "AKIA****DN7A",
  severity: "critical",
  scanId: "test",
  repoId: "test",
  userId: "test",
  commitSha: "test123",
};

channel.publish(
  "secretscan_events",
  "finding.raw",
  Buffer.from(JSON.stringify(event)),
  { persistent: true, contentType: "application/json" }
);

console.log("Evento finding.raw de prueba publicado");

await channel.close();
await connection.close();