import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
    },

    brandMapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandMap"
    },

    brandName: String,
    domain: String,

    fullName: String,
    firstName: String,
    lastName: String,

    email: String,
    designation: String,
    role: String,
    department: String,

    source: {
      type: String,
      enum: ["website", "email_discovery", "hunter", "apollo", "prospeo", "manual"],
      default: "email_discovery"
    },

    confidence: Number,

    status: {
      type: String,
      enum: [
        "new",
        "email_found",
        "email_missing",
        "verification_pending",
        "verified",
        "invalid",
        "risky",
        "pushed",
        "bounced",
        "skipped"
      ],
      default: "email_found"
    },

    verificationStatus: {
      type: String,
      default: "not_verified"
    },

    verifierProvider: String,
    verifierResult: String,
    verifierSubResult: String,
    verifiedAt: Date,

    raw: Object
  },
  { timestamps: true }
);

ContactSchema.index({ seedBrandId: 1 });
ContactSchema.index({ brandMapId: 1 });
ContactSchema.index({ brandName: 1, domain: 1 });
ContactSchema.index({ email: 1 });
ContactSchema.index({ brandMapId: 1, email: 1 });

export const Contact: any =
  mongoose.models.Contact || mongoose.model("Contact", ContactSchema);
