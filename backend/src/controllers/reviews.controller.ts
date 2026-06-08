import type { Request, Response } from "express";
import mongoose from "mongoose";

const LatestReviewSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const LatestReview =
  mongoose.models.LatestReview ||
  mongoose.model("LatestReview", LatestReviewSchema, "latestreviews");

function clean(value: any) {
  return String(value || "").trim();
}

function numberValue(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getYoutubeApiKey() {
  const keys = [
    clean(process.env.YOUTUBE_API_KEY),
    ...clean(process.env.YOUTUBE_API_KEYS)
      .split(",")
      .map((key) => key.replace(/^["']|["']$/g, "").trim()),
  ].filter(Boolean);

  return keys[0] || "";
}

function parseDurationSec(duration: string) {
  const match = clean(duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return 0;

  return (
    numberValue(match[1]) * 3600 +
    numberValue(match[2]) * 60 +
    numberValue(match[3])
  );
}

function getChannelConfig(channel: string) {
  const slug = clean(channel).toLowerCase();

  if (slug === "mhd" || slug === "mhd-tech" || slug === "mhdtech") {
    return {
      slug: "mhd",
      label: "MHD Tech",
      channelId: clean(process.env.MHD_TECH_CHANNEL_ID),
    };
  }

  return {
    slug: "enoylity",
    label: "Enoylity Technology",
    channelId: clean(process.env.ENOYLITY_CHANNEL_ID),
  };
}

function reviewQuery(channel: string) {
  const config = getChannelConfig(channel);

  return {
    $or: [
      { reviewChannel: config.slug },
      { source: config.slug },
      { channel: config.slug },
      { channel: config.label },
      { brandName: config.label },
      { ownerChannel: config.label },
      { channelId: config.channelId },
    ],
  };
}

async function youtubeGet(path: string, params: Record<string, string>) {
  const key = getYoutubeApiKey();

  if (!key) {
    throw new Error("YOUTUBE_API_KEY missing");
  }

  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);

  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }

  url.searchParams.set("key", key);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "YouTube API request failed");
  }

  return data;
}

async function fetchAndSaveLatestReviews(channel: string) {
  const config = getChannelConfig(channel);

  if (!config.channelId) {
    throw new Error(`${config.label} channel ID missing in env`);
  }

  const channelResponse = await youtubeGet("channels", {
    part: "snippet,contentDetails",
    id: config.channelId,
  });

  const channelItem = channelResponse?.items?.[0];

  if (!channelItem) {
    return [];
  }

  const uploadsPlaylistId =
    channelItem?.contentDetails?.relatedPlaylists?.uploads || "";

  if (!uploadsPlaylistId) {
    return [];
  }

  const playlistResponse = await youtubeGet("playlistItems", {
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: "50",
  });

  const videoIds = (playlistResponse?.items || [])
    .map((item: any) => clean(item?.contentDetails?.videoId))
    .filter(Boolean);

  if (videoIds.length === 0) {
    return [];
  }

  const videosResponse = await youtubeGet("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
    maxResults: "50",
  });

  const rows = (videosResponse?.items || []).map((video: any) => {
    const snippet = video?.snippet || {};
    const statistics = video?.statistics || {};
    const contentDetails = video?.contentDetails || {};

    const videoId = clean(video?.id);
    const publishedDate = snippet?.publishedAt
      ? new Date(snippet.publishedAt)
      : null;

    return {
      reviewChannel: config.slug,
      ownerChannel: config.label,
      channelId: config.channelId,
      channelName: clean(snippet?.channelTitle) || config.label,
      videoId,
      videoTitle: clean(snippet?.title),
      videoDescription: clean(snippet?.description),
      videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
      thumbnailUrl:
        snippet?.thumbnails?.maxres?.url ||
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        "",
      publishedDate,
      viewCount: numberValue(statistics?.viewCount),
      likeCount: numberValue(statistics?.likeCount),
      commentCount: numberValue(statistics?.commentCount),
      durationSec: parseDurationSec(contentDetails?.duration),
      raw: video,
      syncedAt: new Date(),
    };
  });

  for (const row of rows) {
    if (!row.videoId) continue;

    await LatestReview.findOneAndUpdate(
      {
        reviewChannel: config.slug,
        videoId: row.videoId,
      },
      {
        $set: row,
      },
      {
        upsert: true,
        new: true,
      }
    );
  }

  return rows;
}

export async function getReviews(req: Request, res: Response) {
  try {
    const channel = clean(req.params.channel || req.query.channel || "enoylity");
    const query = reviewQuery(channel);

    let rows = await LatestReview.find(query)
      .sort({ publishedDate: -1, createdAt: -1 })
      .limit(100)
      .lean();

    if (rows.length === 0) {
      await fetchAndSaveLatestReviews(channel);

      rows = await LatestReview.find(query)
        .sort({ publishedDate: -1, createdAt: -1 })
        .limit(100)
        .lean();
    }

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load reviews",
    });
  }
}

export async function syncReviews(req: Request, res: Response) {
  try {
    const channel = clean(req.params.channel || req.body?.channel || "enoylity");

    const rows = await fetchAndSaveLatestReviews(channel);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to sync reviews",
    });
  }
}
