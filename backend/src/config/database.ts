import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri, {
    // Mongo is remote: compress driver traffic (zlib ships with Node; the
    // server negotiates and silently skips it if unsupported).
    compressors: ["zlib"]
  });
  console.log("MongoDB connected");
}