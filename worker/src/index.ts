import "dotenv/config";
import mongoose from "mongoose";
import { Worker } from "bullmq";
import { intelligenceProcessor } from "./processors/intelligence.processor";

const mongoUri = process.env.MONGODB_URI || "";
const queueName = process.env.INTELLIGENCE_QUEUE_NAME || "intelligence";

const redisConnection: any = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379)
};

if (process.env.REDIS_PASSWORD) {
  redisConnection.password = process.env.REDIS_PASSWORD;
}

async function startWorker() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI missing in worker env");
  }

  await mongoose.connect(mongoUri);

  console.log("Worker MongoDB connected");
  console.log("Worker queue:", queueName);
  console.log("Worker Redis:", `${redisConnection.host}:${redisConnection.port}`);

  const worker = new Worker(
    queueName,
    async (job) => {
      console.log("Worker received job:", {
        id: job.id,
        name: job.name,
        data: job.data
      });

      if (job.name === "run-intelligence" || job.name === "intelligence") {
        return intelligenceProcessor(job);
      }

      return intelligenceProcessor(job);
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 1)
    }
  );

  worker.on("completed", (job) => {
    console.log("Worker job completed:", job.id);
  });

  worker.on("failed", (job, error) => {
    console.error("Worker job failed:", job?.id, error.message);
  });

  console.log("Worker started and listening for intelligence jobs");
}

startWorker().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
