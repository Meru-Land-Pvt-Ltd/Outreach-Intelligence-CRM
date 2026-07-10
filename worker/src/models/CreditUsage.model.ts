import mongoose from "mongoose";

const CreditUsageSchema = new mongoose.Schema(
  {
    provider: String,
    action: String,
    brandName: String,
    domain: String,
    normalizedDomain: String,
    seedBrandId: mongoose.Schema.Types.ObjectId,
    brandMapId: mongoose.Schema.Types.ObjectId,
    jobId: String,
    credits: { type: Number, default: 1 },
    // "actual" when the provider response reported usage, "estimated" when
    // inferred from the number/kind of API calls made.
    usageType: { type: String, default: "estimated" },
    emailsFound: { type: Number, default: 0 },
    contactsSelected: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    error: { type: String, default: "" },
    raw: Object
  },
  { timestamps: true }
);

CreditUsageSchema.index({ provider: 1, createdAt: -1 });
CreditUsageSchema.index({ brandName: 1, domain: 1 });
CreditUsageSchema.index({ seedBrandId: 1 });

export const CreditUsage: any =
  mongoose.models.CreditUsage ||
  mongoose.model("CreditUsage", CreditUsageSchema);
