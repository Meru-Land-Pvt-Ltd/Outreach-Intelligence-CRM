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
    nicheRaw: String,
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
    // Status the row had just before it was excluded, so a restore can put
    // the brand back exactly where it was (approved stays approved).
    previousSelectionStatus: String,

    // PGA score (probability of acquisition): 4-criterion AI web-search
    // rating. pgaScore is the rounded mean of the sub-scores; brands under
    // the pgaMinScore setting are auto-excluded at crawl time.
    pgaScore: Number,
    pgaSubScores: {
      productLaunch: Number,
      creatorCollab: Number,
      promoActivity: Number,
      usAvailability: Number
    },
    pgaSummary: String,
    pgaSignals: [Object],
    pgaCheckedAt: Date,
    pgaStatus: String,
    pgaRaw: Object,

    raw: Object
  },
  { timestamps: true }
);

BrandMapSchema.index({ selectionStatus: 1 });
BrandMapSchema.index({ seedBrandId: 1, selectionStatus: 1 });
BrandMapSchema.index({ seedBrandId: 1, pgaCheckedAt: 1 });
BrandMapSchema.index({ domain: 1, pgaCheckedAt: -1 });

export const BrandMap =
  mongoose.models.BrandMap || mongoose.model("BrandMap", BrandMapSchema);
