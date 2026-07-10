import mongoose from "mongoose";

const ExcludedBrandSchema = new mongoose.Schema(
  {
    brandName: String,
    domain: String,
    normalizedBrandName: String,
    normalizedDomain: String,
    source: String,
    reason: String,
    brandMapId: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

ExcludedBrandSchema.index({ brandName: 1 });
ExcludedBrandSchema.index({ domain: 1 });
// Non-unique on purpose: legacy rows may contain duplicates and a unique index
// would crash index builds on startup. Writers use atomic upserts keyed on the
// normalized fields instead.
ExcludedBrandSchema.index({ normalizedBrandName: 1 });
ExcludedBrandSchema.index({ normalizedDomain: 1 });

export const ExcludedBrand =
  mongoose.models.ExcludedBrand ||
  mongoose.model("ExcludedBrand", ExcludedBrandSchema);
