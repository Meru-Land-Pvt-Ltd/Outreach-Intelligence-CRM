import { env } from "../config/env";
import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import {
  searchYoutubeVideos,
  getYoutubeVideoDetails,
  getYoutubeChannelDetails
} from "./youtubeApi.service";

type CrawlInput = {
  seedBrandId: string;
  brandName: string;
  productName?: string;
};

const GENERIC_PRODUCT_TOKENS = new Set([
  "max",
  "pro",
  "plus",
  "mini",
  "ultra",
  "air",
  "new",
  "the",
  "and",
  "for",
  "with",
  "review",
  "unboxing",
  "sponsored",
  "series",
  "version",
  "edition",
  "gen"
]);

function getPublishedAfterDate() {
  const date = new Date();
  date.setDate(date.getDate() - env.videoLookbackDays);
  return date.toISOString();
}

function normalizeText(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeaningfulTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !GENERIC_PRODUCT_TOKENS.has(token));
}

function isSeedVideoRelevant(video: any, brandName: string, productName?: string) {
  const title = normalizeText(video?.snippet?.title);
  const description = normalizeText(video?.snippet?.description);
  const tags = Array.isArray(video?.snippet?.tags)
    ? normalizeText(video.snippet.tags.join(" "))
    : "";

  const text = `${title} ${description} ${tags}`;

  const brand = normalizeText(brandName);
  const product = normalizeText(productName);
  const productTokens = getMeaningfulTokens(product);

  if (product) {
    if (text.includes(product)) return true;

    const hasBrand = brand ? text.includes(brand) : false;
    const hasStrongProductToken = productTokens.some((token) =>
      text.includes(token)
    );

    return hasBrand && hasStrongProductToken;
  }

  if (brand) {
    return text.includes(brand);
  }

  return false;
}

function buildSeedSearchQueries(brandName: string, productName?: string) {
  const brand = String(brandName || "").trim();
  const product = String(productName || "").trim();

  const queries: string[] = [];

  if (brand && product) {
    queries.push(`${brand} ${product} review`);
    queries.push(`${brand} ${product} unboxing`);
    queries.push(`${brand} ${product} sponsored`);
    queries.push(`${brand} ${product}`);

    queries.push(`${product} ${brand} review`);
    queries.push(`${product} review`);
  } else if (brand) {
    queries.push(`${brand} review`);
    queries.push(`${brand} unboxing`);
    queries.push(`${brand} sponsored`);
    queries.push(brand);
  }

  return Array.from(new Set(queries));
}

function parseYoutubeDurationToSeconds(duration: string) {
  if (!duration) return 0;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function toNumber(value: any) {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function collectSeedInfluencerChannels(input: CrawlInput) {
  const publishedAfter = getPublishedAfterDate();
  const queries = buildSeedSearchQueries(input.brandName, input.productName);

  const seedVideoIdToKeyword = new Map<string, string>();

  for (const query of queries) {
    console.log("Searching seed videos:", query);

    const result = await searchYoutubeVideos({
      query,
      publishedAfter,
      maxResults: 50,
      order: "relevance"
    });

    for (const item of result.items || []) {
      const videoId = item?.id?.videoId;

      if (!videoId) continue;

      if (!seedVideoIdToKeyword.has(videoId)) {
        seedVideoIdToKeyword.set(videoId, query);
      }
    }
  }

  const seedVideoIds = Array.from(seedVideoIdToKeyword.keys()).slice(0, 50);

  const seedVideoDetails: any[] = [];

  for (const chunk of chunkArray(seedVideoIds, 50)) {
    const result = await getYoutubeVideoDetails(chunk);
    seedVideoDetails.push(...(result.items || []));
  }

  const channelMap = new Map<
    string,
    {
      channelId: string;
      channelName: string;
      seedVideoId: string;
      seedVideoUrl: string;
      seedSearchKeyword: string;
    }
  >();

  for (const video of seedVideoDetails) {
    if (!isSeedVideoRelevant(video, input.brandName, input.productName)) {
      continue;
    }

    const channelId = video?.snippet?.channelId;
    const channelName = video?.snippet?.channelTitle || "";
    const seedVideoId = video.id;

    if (!channelId || channelMap.has(channelId)) {
      continue;
    }

    channelMap.set(channelId, {
      channelId,
      channelName,
      seedVideoId,
      seedVideoUrl: "https://www.youtube.com/watch?v=" + seedVideoId,
      seedSearchKeyword: seedVideoIdToKeyword.get(seedVideoId) || ""
    });

    if (channelMap.size >= env.maxChannelsPerSeed) {
      break;
    }
  }

  return Array.from(channelMap.values());
}

async function collectRecentVideosFromChannels(channels: any[]) {
  const publishedAfter = getPublishedAfterDate();
  const videoIdToSource = new Map<string, any>();

  for (const channel of channels) {
    console.log("Crawling influencer channel:", channel.channelName, channel.channelId);

    let pageToken: string | undefined = undefined;
    let pagesFetched = 0;
    let channelVideosFound = 0;

    do {
      const result = await searchYoutubeVideos({
        channelId: channel.channelId,
        publishedAfter,
        maxResults: 50,
        pageToken,
        order: "date"
      });

      for (const item of result.items || []) {
        const videoId = item?.id?.videoId;

        if (!videoId) continue;

        if (!videoIdToSource.has(videoId)) {
          videoIdToSource.set(videoId, channel);
          channelVideosFound += 1;
        }

        if (channelVideosFound >= env.maxVideosPerChannel) {
          break;
        }

        if (videoIdToSource.size >= env.maxVideosPerSeed) {
          break;
        }
      }

      pageToken = result.nextPageToken;
      pagesFetched += 1;

      if (channelVideosFound >= env.maxVideosPerChannel) break;
      if (videoIdToSource.size >= env.maxVideosPerSeed) break;
    } while (pageToken && pagesFetched < 2);

    if (videoIdToSource.size >= env.maxVideosPerSeed) {
      break;
    }
  }

  return videoIdToSource;
}

export async function crawlSeedBrandYoutubeVideos(input: CrawlInput) {
  console.log("Seed brand:", input.brandName);
  console.log("Seed product:", input.productName || "");

  const influencerChannels = await collectSeedInfluencerChannels(input);

  console.log(
    "Influencer channels found via seed:",
    influencerChannels.map((c) => c.channelName)
  );

  if (influencerChannels.length === 0) {
    return {
      seedChannelsFound: 0,
      found: 0,
      saved: 0,
      skippedBySubscribers: 0
    };
  }

  const videoIdToSource = await collectRecentVideosFromChannels(influencerChannels);

  const videoIds = Array.from(videoIdToSource.keys()).slice(
    0,
    env.maxVideosPerSeed
  );

  if (videoIds.length === 0) {
    return {
      seedChannelsFound: influencerChannels.length,
      found: 0,
      saved: 0,
      skippedBySubscribers: 0
    };
  }

  const videoDetails: any[] = [];

  for (const chunk of chunkArray(videoIds, 50)) {
    const result = await getYoutubeVideoDetails(chunk);
    videoDetails.push(...(result.items || []));
  }

  const channelIds = videoDetails
    .map((video) => video?.snippet?.channelId)
    .filter(Boolean);

  const channelDetailsMap = new Map<string, any>();

  for (const chunk of chunkArray(Array.from(new Set(channelIds)), 50)) {
    const result = await getYoutubeChannelDetails(chunk);

    for (const channel of result.items || []) {
      channelDetailsMap.set(channel.id, channel);
    }
  }

  let saved = 0;
  let skippedBySubscribers = 0;

  for (const video of videoDetails) {
    const snippet = video.snippet || {};
    const statistics = video.statistics || {};
    const contentDetails = video.contentDetails || {};
    const channel = channelDetailsMap.get(snippet.channelId);
    const channelStats = channel?.statistics || {};
    const subscriberCount = toNumber(channelStats.subscriberCount);

    if (
      subscriberCount < env.minSubscribers ||
      subscriberCount > env.maxSubscribers
    ) {
      skippedBySubscribers += 1;
      continue;
    }

    const source = videoIdToSource.get(video.id);
    const videoUrl = "https://www.youtube.com/watch?v=" + video.id;

    await RawYoutubeVideo.updateOne(
      {
        seedBrandId: input.seedBrandId,
        videoId: video.id
      },
      {
        $set: {
          seedBrandId: input.seedBrandId,
          seedBrandName: input.brandName,

          channelName: snippet.channelTitle || "",
          channelId: snippet.channelId || "",
          videoUrl,
          videoTitle: snippet.title || "",
          videoDescription: String(snippet.description || "").substring(
            0,
            2000
          ),

          publishedDate: snippet.publishedAt
            ? new Date(snippet.publishedAt)
            : undefined,
          addedOn: new Date(),

          durationSec: parseYoutubeDurationToSeconds(contentDetails.duration),
          viewCount: toNumber(statistics.viewCount),
          likeCount: toNumber(statistics.likeCount),
          commentCount: toNumber(statistics.commentCount),
          subscriberCount,
          channelCountry: channel?.snippet?.country || "",

          channelCategory: "",
          sponsorBrand: "",
          promoCode: "",
          productNameWithModel: "",
          sponsorshipType: "",

          videoId: video.id,
          channelUrl: snippet.channelId
            ? "https://www.youtube.com/channel/" + snippet.channelId
            : "",
          youtubeCategoryId: snippet.categoryId || "",
          searchKeyword: source?.seedSearchKeyword || "",
          relevanceStatus: "influencer-channel-video",
          isSponsored: false,

          raw: {
            video,
            channel,
            foundViaSeedBrand: input.brandName,
            seedProductName: input.productName || "",
            seedVideoId: source?.seedVideoId || "",
            seedVideoUrl: source?.seedVideoUrl || "",
            seedChannelName: source?.channelName || "",
            seedChannelId: source?.channelId || ""
          }
        }
      },
      {
        upsert: true
      }
    );

    saved += 1;
  }

  console.log("YouTube influencer crawl result:", {
    seedChannelsFound: influencerChannels.length,
    found: videoIds.length,
    saved,
    skippedBySubscribers
  });

  return {
    seedChannelsFound: influencerChannels.length,
    found: videoIds.length,
    saved,
    skippedBySubscribers
  };
}
