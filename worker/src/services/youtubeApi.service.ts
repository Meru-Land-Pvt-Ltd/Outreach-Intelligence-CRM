import axios from "axios";
import { env } from "../config/env";
import {
  getYoutubeApiKey,
  rotateYoutubeApiKey,
  getCurrentYoutubeKeyIndex
} from "./youtubeKey.service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isYoutubeQuotaError(error: any, data?: any) {
  const status = error?.response?.status;
  const message =
    data?.error?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    "";

  return status === 403 || String(message).toLowerCase().includes("quota");
}

async function youtubeGet(baseUrl: string, params: Record<string, any>) {
  while (true) {
    const key = getYoutubeApiKey();

    try {
      await sleep(250);

      const cleanParams: Record<string, any> = {};

      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
          cleanParams[k] = v;
        }
      }

      const response = await axios.get(baseUrl, {
        params: {
          ...cleanParams,
          key
        },
        timeout: 30000
      });

      const data = response.data;

      if (data?.error && isYoutubeQuotaError(null, data)) {
        console.log(
          "YouTube key #" + (getCurrentYoutubeKeyIndex() + 1) + " quota exhausted."
        );

        if (!rotateYoutubeApiKey()) {
          throw new Error("All YouTube API keys exhausted");
        }

        continue;
      }

      return data;
    } catch (error: any) {
      if (isYoutubeQuotaError(error)) {
        console.log(
          "YouTube key #" + (getCurrentYoutubeKeyIndex() + 1) + " quota exhausted."
        );

        if (!rotateYoutubeApiKey()) {
          throw new Error("All YouTube API keys exhausted");
        }

        continue;
      }

      throw error;
    }
  }
}

export async function searchYoutubeVideos(params: {
  query?: string;
  channelId?: string;
  publishedAfter?: string;
  maxResults?: number;
  pageToken?: string;
  order?: "date" | "relevance" | "viewCount";
}) {
  return youtubeGet(env.youtubeSearchBaseUrl, {
    part: "snippet",
    q: params.query,
    channelId: params.channelId,
    type: "video",
    order: params.order || "relevance",
    maxResults: params.maxResults || 50,
    publishedAfter: params.publishedAfter,
    pageToken: params.pageToken || undefined
  });
}

export async function getYoutubeVideoDetails(videoIds: string[]) {
  if (videoIds.length === 0) {
    return { items: [] };
  }

  return youtubeGet(env.youtubeVideosBaseUrl, {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
    maxResults: 50
  });
}

export async function getYoutubeChannelDetails(channelIds: string[]) {
  if (channelIds.length === 0) {
    return { items: [] };
  }

  const uniqueIds = Array.from(new Set(channelIds));

  return youtubeGet(env.youtubeChannelsBaseUrl, {
    part: "snippet,statistics",
    id: uniqueIds.join(","),
    maxResults: 50
  });
}
