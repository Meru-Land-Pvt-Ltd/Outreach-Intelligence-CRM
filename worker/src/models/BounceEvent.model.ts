import mongoose from "mongoose";

const BounceEventSchema = new mongoose.Schema(
  {
    email: String,
    campaignId: String,
    eventType: String,
    reason: String,
    source: String,
    raw: Object
  },
  { timestamps: true }
);

BounceEventSchema.index({ email: 1 });
BounceEventSchema.index({ campaignId: 1 });

export const BounceEvent: any =
  mongoose.models.BounceEvent || mongoose.model("BounceEvent", BounceEventSchema);
