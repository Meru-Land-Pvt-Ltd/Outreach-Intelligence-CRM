import mongoose from "mongoose";

const RunLogSchema = new mongoose.Schema(
  {
    latestLog: { type: String, default: "" },
    failedExecution: { type: String, default: "" },
    module: { type: String, default: "" },
    level: { type: String, default: "info" },
    message: { type: String, default: "" },
    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const RunLog: any =
  mongoose.models.RunLog || mongoose.model("RunLog", RunLogSchema);
