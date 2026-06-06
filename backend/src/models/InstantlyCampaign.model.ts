import mongoose from "mongoose";

const InstantlyCampaignSchema = new mongoose.Schema(
  {
    channel: String,
    campaignName: String,
    instantlyCampaignId: String,

    startDate: String,
    endDate: String,
    startTime: String,
    endTime: String,

    dailyLimit: Number,
    leadsPushed: Number,
    validLeadsFound: Number,
    selectedSenders: [String],

    status: String,
    pushedAt: Date,
    activatedAt: Date,

    raw: Object
  },
  { timestamps: true }
);

InstantlyCampaignSchema.index({ instantlyCampaignId: 1 });
InstantlyCampaignSchema.index({ channel: 1 });
InstantlyCampaignSchema.index({ campaignName: 1 });

export const InstantlyCampaign: any =
  mongoose.models.InstantlyCampaign ||
  mongoose.model("InstantlyCampaign", InstantlyCampaignSchema);
