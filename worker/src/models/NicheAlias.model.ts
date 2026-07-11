import mongoose from "mongoose";

const NicheAliasSchema = new mongoose.Schema(
  {
    // rawNiche is stored lowercased for cache lookups.
    rawNiche: { type: String, required: true, unique: true },
    canonicalNiche: { type: String, required: true },
    source: { type: String, default: "ai" },
    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const NicheAlias: any =
  mongoose.models.NicheAlias ||
  mongoose.model("NicheAlias", NicheAliasSchema);
