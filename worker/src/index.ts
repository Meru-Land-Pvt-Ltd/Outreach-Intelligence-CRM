import "dotenv/config";
import mongoose from "mongoose";
import { Worker } from "bullmq";
import { intelligenceProcessor } from "./processors/intelligence.processor";
import {
  discoverEmailsJob,
  processSelectedBrandsJob
} from "./processors/manualActions.processor";

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
    async (job, token) => {
      console.log("Worker received job:", {
        id: job.id,
        name: job.name,
        data: job.data
      });

      if (job.name === "process-selected-brands") {
        return processSelectedBrandsJob(job, token);
      }

      if (job.name === "discover-emails") {
        return discoverEmailsJob(job, token);
      }

      return intelligenceProcessor(job, token);
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

  worker.on("error", (error) => {
    console.error("Worker error:", error?.message || error);
  });

  console.log("Worker started and listening for intelligence jobs");
}

startWorker().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
