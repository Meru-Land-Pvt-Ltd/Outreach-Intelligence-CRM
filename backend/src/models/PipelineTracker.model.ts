import mongoose from "mongoose";

const PipelineTrackerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Seed", "Discovered"],
      required: true
    },
    brandName: String,
    domain: String,
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const PipelineTracker =
  mongoose.models.PipelineTracker ||
  mongoose.model("PipelineTracker", PipelineTrackerSchema);
