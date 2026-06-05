import mongoose from "mongoose";

const ExcludedBrandSchema = new mongoose.Schema(
  {
    brandName: String,
    domain: String
  },
  { timestamps: true }
);

export const ExcludedBrand: any =
  mongoose.models.ExcludedBrand ||
  mongoose.model("ExcludedBrand", ExcludedBrandSchema);
