import mongoose from "mongoose";

const RawYoutubeVideoSchema = new mongoose.Schema(
  {
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand",
    },

    seedBrandName: String,

    channelName: String,
    channelId: String,
    videoUrl: String,
    videoTitle: String,
    videoDescription: String,
    publishedDate: Date,
    addedOn: Date,
    durationSec: Number,
    viewCount: Number,
    likeCount: Number,
    commentCount: Number,
    subscriberCount: Number,
    channelCountry: String,
    channelCategory: String,
    category: String,
    sponsorBrand: String,
    promoCode: String,
    productNameWithModel: String,
    productName: String,
    sponsorshipType: String,
    aiProcessed: Boolean,
    analysisStatus: String,
    analysisError: String,
    analyzedAt: Date,

    videoId: String,
    channelUrl: String,
    youtubeCategoryId: String,
    searchKeyword: String,
    relevanceStatus: String,
    isSponsored: Boolean,
    raw: Object,
  },
  { timestamps: true }
);

RawYoutubeVideoSchema.index({
  addedOn: -1,
  publishedDate: -1,
  createdAt: -1,
});

RawYoutubeVideoSchema.index({
  seedBrandId: 1,
  addedOn: -1,
  publishedDate: -1,
  createdAt: -1,
});

RawYoutubeVideoSchema.index({
  videoId: 1,
});

RawYoutubeVideoSchema.index({
  channelId: 1,
});

export const RawYoutubeVideo =
  mongoose.models.RawYoutubeVideo ||
  mongoose.model("RawYoutubeVideo", RawYoutubeVideoSchema);