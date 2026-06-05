import { env } from "../config/env";

let currentKeyIndex = 0;

function getAllYoutubeKeys() {
  const keys = [env.youtubeApiKey, ...env.youtubeApiKeys]
    .map((key) => String(key || "").trim())
    .filter(Boolean);

  return Array.from(new Set(keys));
}

export function getYoutubeApiKey() {
  const keys = getAllYoutubeKeys();

  if (keys.length === 0) {
    throw new Error(
      "No YouTube API keys found. Add YOUTUBE_API_KEY or YOUTUBE_API_KEYS in worker/.env"
    );
  }

  return keys[currentKeyIndex];
}

export function rotateYoutubeApiKey() {
  const keys = getAllYoutubeKeys();

  currentKeyIndex += 1;

  if (currentKeyIndex >= keys.length) {
    return false;
  }

  console.log(
    "Rotated to YouTube API key #" + (currentKeyIndex + 1) + " of " + keys.length
  );

  return true;
}

export function getCurrentYoutubeKeyIndex() {
  return currentKeyIndex;
}
