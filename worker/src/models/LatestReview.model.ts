import mongoose from "mongoose";

const LatestReviewSchema = new mongoose.Schema(
  {
    channel: { type: String, required: true, index: true },
    channelId: { type: String, default: "" },

    videoId: { type: String, required: true, index: true },
    videoTitle: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    publishedDate: { type: Date, default: null },

    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },

    duration: { type: String, default: "" },
    durationSeconds: { type: Number, default: 0 },
    niche: { type: String, default: "" },

    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

LatestReviewSchema.index({ channel: 1, videoId: 1 }, { unique: true });

export const LatestReview: any =
  mongoose.models.LatestReview ||
  mongoose.model("LatestReview", LatestReviewSchema);
