import axios from "axios";
import { LatestReview } from "../models/LatestReview.model";
import { logDone, logError } from "./runLog.service";

const LatestReviewModel = LatestReview as any;

const ENOYLITY_CHANNEL_ID =
  process.env.ENOYLITY_CHANNEL_ID || "UCa6P1Y-M5qq7OME3t98Iarw";

const MHD_TECH_CHANNEL_ID =
  process.env.MHD_TECH_CHANNEL_ID || "UCcDL0l3hzs7VycGXn2r6OXA";

let currentKeyIndex = 0;

function youtubeKeys() {
  const keys = [
    ...(process.env.YOUTUBE_API_KEYS || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
    process.env.YOUTUBE_API_KEY || ""
  ].filter(Boolean);

  return Array.from(new Set(keys));
}

function getKey() {
  const keys = youtubeKeys();

  if (keys.length === 0) {
    throw new Error("No YouTube API keys configured");
  }

  return keys[currentKeyIndex] || keys[0];
}

function rotateKey() {
  const keys = youtubeKeys();

  currentKeyIndex += 1;

  return currentKeyIndex < keys.length;
}

async function ytFetch(url: string): Promise<any> {
  while (true) {
    const joiner = url.includes("?") ? "&" : "?";
    const fullUrl = url + joiner + "key=" + encodeURIComponent(getKey());

    const response = await axios.get(fullUrl, {
      timeout: 30000,
      validateStatus: () => true
    });

    const data = response.data;

    if (
      data?.error &&
      (data.error.code === 403 ||
        String(data.error.message || "").toLowerCase().includes("quota"))
    ) {
      if (rotateKey()) {
        continue;
      }

      throw new Error("All YouTube API keys exhausted");
    }

    return data;
  }
}

function parseIsoDurationToSeconds(duration: string) {
  const match = String(duration || "").match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function secondsToDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
  }

  return [mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

async function aiNicheForVideo(title: string) {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key) return "";

  const prompt =
    "Classify this YouTube review video into one short niche label.\n\n" +
    "Title: " +
    title +
    "\n\nReturn only the niche name.";

  try {
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Return only a short niche label." },
          { role: "user", content: prompt }
        ],
        temperature: 0
      },
      {
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    return String(response.data?.choices?.[0]?.message?.content || "")
      .trim()
      .split("\n")[0]
      .trim();
  } catch {
    return "";
  }
}

async function getVideoDetails(videoIds: string[]) {
  if (videoIds.length === 0) return [];

  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    "?part=snippet,contentDetails,statistics" +
    "&id=" +
    videoIds.map(encodeURIComponent).join(",");

  const data = await ytFetch(url);

  return data.items || [];
}

async function crawlChannel(input: {
  channel: string;
  channelId: string;
}) {
  const uploadsPlaylistId = input.channelId.replace(/^UC/, "UU");
  let nextPageToken = "";
  let added = 0;
  let scanned = 0;

  while (true) {
    const playlistUrl =
      "https://www.googleapis.com/youtube/v3/playlistItems" +
      "?part=snippet" +
      "&playlistId=" +
      encodeURIComponent(uploadsPlaylistId) +
      "&maxResults=50" +
      (nextPageToken
        ? "&pageToken=" + encodeURIComponent(nextPageToken)
        : "");

    const playlistData = await ytFetch(playlistUrl);
    const items = playlistData.items || [];

    if (items.length === 0) break;

    const ids = items
      .map((item: any) => item?.snippet?.resourceId?.videoId)
      .filter(Boolean);

    const details = await getVideoDetails(ids);

    for (const video of details) {
      const videoId = video.id;
      const snippet = video.snippet || {};
      const stats = video.statistics || {};
      const contentDetails = video.contentDetails || {};

      const existing = await LatestReviewModel.findOne({
        channel: input.channel,
        videoId
      });

      const views = Number(stats.viewCount || 0);
      const likes = Number(stats.likeCount || 0);
      const comments = Number(stats.commentCount || 0);
      const engagementRate =
        views > 0 ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0;

      const durationSeconds = parseIsoDurationToSeconds(
        contentDetails.duration
      );

      const niche = existing?.niche || (await aiNicheForVideo(snippet.title));

      await LatestReviewModel.findOneAndUpdate(
        {
          channel: input.channel,
          videoId
        },
        {
          $set: {
            channel: input.channel,
            channelId: input.channelId,
            videoId,
            videoTitle: snippet.title || "",
            videoUrl: "https://www.youtube.com/watch?v=" + videoId,
            thumbnailUrl:
              snippet.thumbnails?.maxres?.url ||
              snippet.thumbnails?.high?.url ||
              snippet.thumbnails?.medium?.url ||
              "",
            publishedDate: snippet.publishedAt
              ? new Date(snippet.publishedAt)
              : null,
            views,
            likes,
            comments,
            engagementRate,
            duration: secondsToDuration(durationSeconds),
            durationSeconds,
            niche,
            raw: video
          }
        },
        {
          upsert: true,
          new: true
        }
      );

      scanned += 1;

      if (!existing) {
        added += 1;
      }
    }

    if (!playlistData.nextPageToken) break;

    nextPageToken = playlistData.nextPageToken;
  }

  return {
    channel: input.channel,
    scanned,
    added
  };
}

export async function crawlLatestReviewVideos() {
  try {
    const enoylity = await crawlChannel({
      channel: "Enoylity Technology",
      channelId: ENOYLITY_CHANNEL_ID
    });

    const mhd = await crawlChannel({
      channel: "MHD Tech",
      channelId: MHD_TECH_CHANNEL_ID
    });

    await logDone(
      "Latest Reviews",
      "Enoylity added " + enoylity.added + ", MHD added " + mhd.added
    );

    return {
      success: true,
      enoylity,
      mhd
    };
  } catch (error: any) {
    await logError("Latest Reviews", error.message, error);

    throw error;
  }
}
