import mongoose from "mongoose";

const JobLogSchema = new mongoose.Schema(
  {
    jobId: String,

    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
    },

    type: {
      type: String,
      default: "intelligence"
    },

    brandName: String,
    influencerHandle: String,

    status: {
      type: String,
      default: "queued"
    },

    currentStep: String,

    progress: {
      type: Number,
      default: 0
    },

    totalFound: {
      type: Number,
      default: 0
    },

    message: String,
    error: String,
    result: Object,
    raw: Object,

    startedAt: Date,
    completedAt: Date
  },
  {
    timestamps: true,
    strict: false
  }
);

export const JobLog: any =
  mongoose.models.JobLog || mongoose.model("JobLog", JobLogSchema);
