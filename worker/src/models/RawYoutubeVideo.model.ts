import mongoose from "mongoose";

const RawYoutubeVideoSchema = new mongoose.Schema(
  {
    seedBrandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeedBrand"
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
    sponsorBrand: String,
    promoCode: String,
    productNameWithModel: String,
    sponsorshipType: String,

    videoId: String,
    channelUrl: String,
    youtubeCategoryId: String,
    searchKeyword: String,
    relevanceStatus: String,
    isSponsored: Boolean,
    raw: Object
  },
  { timestamps: true }
);

export const RawYoutubeVideo: any =
  mongoose.models.RawYoutubeVideo ||
  mongoose.model("RawYoutubeVideo", RawYoutubeVideoSchema);
