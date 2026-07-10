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

    isSelected: Boolean,
    selectedAt: Date,

    intentScore: Number,
    pgaScore: Number,
    intentStatus: String,
    intentReason: String,
    lastIntentCheckedAt: Date,
    pgaBreakdown: Object,
    intentDataSources: [String],
    insufficientData: Boolean,

    qualityScore: Number,
    qualityReason: String,
    qualityStatus: String,

    raw: Object
  },
  { timestamps: true }
);

BrandMapSchema.index({ isSelected: 1 });
BrandMapSchema.index({ isExcluded: 1 });

export const BrandMap =
  mongoose.models.BrandMap || mongoose.model("BrandMap", BrandMapSchema);
