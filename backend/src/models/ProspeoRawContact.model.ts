import mongoose from "mongoose";

const ProspeoRawContactSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, index: true },
    domain: { type: String, default: "", index: true },
    fullName: { type: String, default: "" },
    title: { type: String, default: "" },
    country: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    emailStatus: { type: String, default: "" },
    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

ProspeoRawContactSchema.index({ brandName: 1, domain: 1, email: 1 });

export const ProspeoRawContact =
  mongoose.models.ProspeoRawContact ||
  mongoose.model("ProspeoRawContact", ProspeoRawContactSchema);
