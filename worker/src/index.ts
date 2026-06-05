import { Worker } from "bullmq";
import { connectDatabase } from "./config/database";
import { redisConnectionOptions } from "./config/redis";
import { intelligenceProcessor } from "./processors/intelligence.processor";

async function startWorker() {
  await connectDatabase();

  new Worker("intelligence", intelligenceProcessor, {
    connection: redisConnectionOptions
  });

  console.log("Worker started and listening for intelligence jobs");
}

startWorker().catch((error) => {
  console.error("Worker failed to start", error);
  process.exit(1);
});