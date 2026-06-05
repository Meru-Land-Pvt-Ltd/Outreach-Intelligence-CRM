import mongoose from "mongoose";

const SeedBrandSchema = new mongoose.Schema(
  {
    brandName: String,
    productName: String,
    channel: String,
    status: {
      type: String,
      default: "pending"
    },
    closedDealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClosedDeal"
    }
  },
  { timestamps: true }
);

export const SeedBrand =
  mongoose.models.SeedBrand || mongoose.model("SeedBrand", SeedBrandSchema);
