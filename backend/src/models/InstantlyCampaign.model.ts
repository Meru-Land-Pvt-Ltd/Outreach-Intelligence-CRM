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

    // Niche grouping: majority niche of the pushed leads plus the Instantly
    // custom tags assigned to the campaign.
    niche: String,
    niches: [String],
    tagIds: [String],
    tagError: String,

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
