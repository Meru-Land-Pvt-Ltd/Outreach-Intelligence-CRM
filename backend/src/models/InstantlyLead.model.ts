import mongoose from "mongoose";

const InstantlyLeadSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["Enoylity Technology", "MHD Tech"],
      required: true
    },

    firstName: String,
    email: String,
    companyName: String,
    productName: String,

    relatedVideo: String,
    competitor1: String,
    competitor2: String,

    pushedStatus: String,
    verificationStatus: String,
    instantlyBounced: String,
    gatewayBounced: String,

    brandMapId: mongoose.Schema.Types.ObjectId,
    contactId: mongoose.Schema.Types.ObjectId,
    campaignId: String,

    raw: Object
  },
  { timestamps: true }
);

InstantlyLeadSchema.index({ channel: 1, email: 1 }, { unique: true });
InstantlyLeadSchema.index({ email: 1 });
InstantlyLeadSchema.index({ companyName: 1 });
InstantlyLeadSchema.index({ pushedStatus: 1 });
InstantlyLeadSchema.index({ verificationStatus: 1 });
InstantlyLeadSchema.index({ instantlyBounced: 1 });

export const InstantlyLead: any =
  mongoose.models.InstantlyLead ||
  mongoose.model("InstantlyLead", InstantlyLeadSchema);
