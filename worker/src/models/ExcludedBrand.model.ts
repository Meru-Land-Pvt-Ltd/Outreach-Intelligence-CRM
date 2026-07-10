import mongoose from "mongoose";

const ExcludedBrandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true
    },
    domain: {
      type: String,
      default: ""
    },
    normalizedBrandName: {
      type: String,
      required: true
    },
    normalizedDomain: {
      type: String,
      default: ""
    },
    source: {
      type: String,
      default: "manual"
    }
  },
  { timestamps: true }
);

ExcludedBrandSchema.index(
  {
    normalizedBrandName: 1,
    normalizedDomain: 1
  },
  {
    unique: true
  }
);

export const ExcludedBrand: any =
  mongoose.models.ExcludedBrand ||
  mongoose.model("ExcludedBrand", ExcludedBrandSchema);
