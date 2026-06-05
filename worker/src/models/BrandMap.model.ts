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
    raw: Object
  },
  { timestamps: true }
);

export const BrandMap: any =
  mongoose.models.BrandMap || mongoose.model("BrandMap", BrandMapSchema);
