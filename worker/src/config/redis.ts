import { env } from "./env";

export const redisConnectionOptions = {
  host: env.redisHost,
  port: env.redisPort,
  password: env.redisPassword || undefined,
  maxRetriesPerRequest: null
};