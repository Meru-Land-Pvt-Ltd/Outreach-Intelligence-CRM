import mongoose from "mongoose";

const JobLogSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true
    },
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
    },
    type: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued"
    },
    currentStep: {
      type: String
    },
    progress: {
      type: Number,
      default: 0
    },
    error: {
      type: String
    }
  },
  { timestamps: true }
);

export const JobLog =
  mongoose.models.JobLog || mongoose.model("JobLog", JobLogSchema);