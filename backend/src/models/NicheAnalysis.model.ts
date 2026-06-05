import mongoose from "mongoose";

const NicheAnalysisSchema = new mongoose.Schema(
  {
    nicheName: String,
    brandCount: Number
  },
  { timestamps: true }
);

export const NicheAnalysis =
  mongoose.models.NicheAnalysis ||
  mongoose.model("NicheAnalysis", NicheAnalysisSchema);
