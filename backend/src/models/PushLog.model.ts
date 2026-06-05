import mongoose from "mongoose";

const PushLogSchema = new mongoose.Schema(
  {
    channel: String,
    campaignName: String,
    campaignId: String,
    totalPushed: Number,
    dailyLimit: Number,
    status: String,
    message: String,
    raw: Object
  },
  { timestamps: true }
);

export const PushLog: any =
  mongoose.models.PushLog || mongoose.model("PushLog", PushLogSchema);
