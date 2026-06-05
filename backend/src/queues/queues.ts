import { Queue } from "bullmq";
import { redisConnectionOptions } from "../config/redis";
import { QUEUES } from "./queueNames";

export const intelligenceQueue = new Queue(QUEUES.INTELLIGENCE, {
  connection: redisConnectionOptions
});