import mongoose from "mongoose";

const ClosedDealSchema = new mongoose.Schema(
  {
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
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

    crawlCount: {
      type: Number,
      default: 0
    },

    raw: Object
  },
  {
    timestamps: true,
    strict: false
  }
);

export const ClosedDeal: any =
  mongoose.models.ClosedDeal || mongoose.model("ClosedDeal", ClosedDealSchema);
