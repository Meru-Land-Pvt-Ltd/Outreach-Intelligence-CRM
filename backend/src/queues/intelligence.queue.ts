import { Queue } from "bullmq";

const redisConnection: any = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379)
};

if (process.env.REDIS_PASSWORD) {
  redisConnection.password = process.env.REDIS_PASSWORD;
}

export const intelligenceQueue = new Queue(
  process.env.INTELLIGENCE_QUEUE_NAME || "intelligence",
  {
    connection: redisConnection
  }
);
