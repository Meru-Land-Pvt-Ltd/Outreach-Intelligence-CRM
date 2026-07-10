import mongoose from "mongoose";

const BrandMapSchema = new mongoose.Schema(
  {
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
    },

    brandName: String,
    foundVia: String,
    channelCount: Number,
    channelNames: [String],
    mostRecentSponsorshipDate: Date,
    recencyTag: String,
    niche: String,
    domain: String,

    seedBrandName: String,
    productNames: [String],
    sourceVideoIds: [String],
    sourceVideoUrls: [String],
    status: String,
    isExcluded: Boolean,

    // Manual campaign selection made in the Brand Map UI.
    selectionStatus: {
      type: String,
      enum: ["pending", "approved", "excluded"],
      default: "pending"
    },
    selectionUpdatedAt: Date,
    selectionUpdatedBy: String,

    // On-demand AI intent scan (probability the brand buys influencer
    // outreach now, based on recent public web activity).
    intentScore: Number,
    intentSummary: String,
    intentSignals: [Object],
    intentCheckedAt: Date,
    intentStatus: String,
    intentRaw: Object,

    raw: Object
  },
  { timestamps: true }
);

BrandMapSchema.index({ selectionStatus: 1 });
BrandMapSchema.index({ seedBrandId: 1, selectionStatus: 1 });

export const BrandMap: any =
  mongoose.models.BrandMap || mongoose.model("BrandMap", BrandMapSchema);
