import mongoose from "mongoose";

const HunterRawContactSchema = new mongoose.Schema(
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

HunterRawContactSchema.index({ brandName: 1, domain: 1, email: 1 });

export const HunterRawContact: any =
  mongoose.models.HunterRawContact ||
  mongoose.model("HunterRawContact", HunterRawContactSchema);
