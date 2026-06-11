import mongoose from "mongoose";

const EmailDiscoverySchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, index: true },
    domain: { type: String, default: "", index: true },

    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    facebook: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    youtube: { type: String, default: "" },
    website: { type: String, default: "" },
    totalEmails: { type: String, default: "" },

    hunter: { type: String, default: "" },
    apollo: { type: String, default: "" },
    prospeo: { type: String, default: "" },
    prospeoCheckedAt: { type: Date, default: null },

    foundVia: { type: String, default: "" },
    seedBrandId: { type: mongoose.Schema.Types.ObjectId, default: null },
    brandMapId: { type: mongoose.Schema.Types.ObjectId, default: null },

    status: { type: String, default: "pending" },
    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

EmailDiscoverySchema.index({ brandName: 1, domain: 1 }, { unique: true });

export const EmailDiscovery =
  mongoose.models.EmailDiscovery ||
  mongoose.model("EmailDiscovery", EmailDiscoverySchema);
