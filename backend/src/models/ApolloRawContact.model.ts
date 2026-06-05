import mongoose from "mongoose";

const ApolloRawContactSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, index: true },
    domain: { type: String, default: "", index: true },
    fullName: { type: String, default: "" },
    title: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    emailVerified: { type: String, default: "" },
    apolloPersonId: { type: String, default: "" },
    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

ApolloRawContactSchema.index({ brandName: 1, domain: 1, apolloPersonId: 1 });
ApolloRawContactSchema.index({ brandName: 1, domain: 1, email: 1 });

export const ApolloRawContact =
  mongoose.models.ApolloRawContact ||
  mongoose.model("ApolloRawContact", ApolloRawContactSchema);
