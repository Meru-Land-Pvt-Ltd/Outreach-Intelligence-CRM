import mongoose from "mongoose";

const SeedBrandSchema = new mongoose.Schema(
  {
    closedDealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClosedDeal"
    },

    month: {
      type: String,
      default: "",
      trim: true
    },

    influencerHandle: {
      type: String,
      default: "",
      trim: true
    },

    brandName: {
      type: String,
      required: true,
      trim: true
    },

    productName: {
      type: String,
      default: "",
      trim: true
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true
    },

    totalDealAmount: {
      type: Number,
      default: 0
    },

    channel: {
      type: String,
      default: "",
      trim: true
    },

    status: {
      type: String,
      default: "pending"
    },

    raw: Object
  },
  {
    timestamps: true,
    strict: false
  }
);

export const SeedBrand: any =
  mongoose.models.SeedBrand || mongoose.model("SeedBrand", SeedBrandSchema);
