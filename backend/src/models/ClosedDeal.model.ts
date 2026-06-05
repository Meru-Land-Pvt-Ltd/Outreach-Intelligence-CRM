import mongoose from "mongoose";

const ClosedDealSchema = new mongoose.Schema(
  {
    month: String,
    influencerHandle: String,
    brandName: String,
    productName: String,
    email: String,
    totalDealAmount: Number,
    crawlCount: {
      type: Number,
      default: 0
    },
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
    }
  },
  { timestamps: true }
);

export const ClosedDeal =
  mongoose.models.ClosedDeal || mongoose.model("ClosedDeal", ClosedDealSchema);
