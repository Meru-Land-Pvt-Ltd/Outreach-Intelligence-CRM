import dotenv from "dotenv";

dotenv.config();

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function booleanEnv(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function listEnv(value: string | undefined) {
  return value
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: numberEnv(process.env.PORT, 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  frontendUrls: listEnv(
    process.env.FRONTEND_URL || "http://localhost:3000, http://192.168.1.7:3000"
  ),

  mongodbUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm",

  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: numberEnv(process.env.REDIS_PORT, 6379),
  redisPassword: process.env.REDIS_PASSWORD || "",

  campaignSheetId: process.env.CAMPAIGN_SHEET_ID || "",
  discoverySheetId: process.env.DISCOVERY_SHEET_ID || "",
  emailDiscoverySheetId: process.env.EMAIL_DISCOVERY_SHEET_ID || "",
  intelligenceSheetId: process.env.INTELLIGENCE_SHEET_ID || "",
  masterIntelSheetId: process.env.MASTER_INTEL_SHEET_ID || "",
  masterEmailSheetId: process.env.MASTER_EMAIL_SHEET_ID || "",

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiChatCompletionsUrl:
    process.env.OPENAI_CHAT_COMPLETIONS_URL ||
    "https://api.openai.com/v1/chat/completions",
  openaiResponsesUrl:
    process.env.OPENAI_RESPONSES_URL ||
    "https://api.openai.com/v1/responses",

  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  youtubeApiKeys: listEnv(process.env.YOUTUBE_API_KEYS),
  youtubeSearchBaseUrl:
    process.env.YOUTUBE_SEARCH_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/search",
  youtubeVideosBaseUrl:
    process.env.YOUTUBE_VIDEOS_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/videos",
  youtubeChannelsBaseUrl:
    process.env.YOUTUBE_CHANNELS_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/channels",
  youtubePlaylistItemsBaseUrl:
    process.env.YOUTUBE_PLAYLIST_ITEMS_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/playlistItems",

  enoylityChannelId: process.env.ENOYLITY_CHANNEL_ID || "",
  mhdTechChannelId: process.env.MHD_TECH_CHANNEL_ID || "",

  apolloApiKey: process.env.APOLLO_API_KEY || "",
  apolloBaseUrl: process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1",
  apolloPeopleSearchEndpoint:
    process.env.APOLLO_PEOPLE_SEARCH_ENDPOINT || "/mixed_people/api_search",
  apolloBulkMatchEndpoint:
    process.env.APOLLO_BULK_MATCH_ENDPOINT || "/people/bulk_match",

  hunterApiKey: process.env.HUNTER_API_KEY || "",
  hunterBaseUrl: process.env.HUNTER_BASE_URL || "https://api.hunter.io/v2",
  hunterDomainSearchEndpoint:
    process.env.HUNTER_DOMAIN_SEARCH_ENDPOINT || "/domain-search",

  prospeoApiKey: process.env.PROSPEO_API_KEY || "",
  prospeoBaseUrl: process.env.PROSPEO_BASE_URL || "https://api.prospeo.io",
  prospeoSearchPersonEndpoint:
    process.env.PROSPEO_SEARCH_PERSON_ENDPOINT || "/search-person",
  prospeoEnrichPersonEndpoint:
    process.env.PROSPEO_ENRICH_PERSON_ENDPOINT || "/enrich-person",

  millionVerifierApiKey: process.env.MILLION_VERIFIER_API_KEY || "",
  millionVerifierBaseUrl:
    process.env.MILLION_VERIFIER_BASE_URL ||
    "https://api.millionverifier.com/api/v3",
  millionVerifierTimeout: numberEnv(process.env.MILLION_VERIFIER_TIMEOUT, 20),

  instantlyApiKey: process.env.INSTANTLY_API_KEY || "",
  instantlyBaseUrl:
    process.env.INSTANTLY_BASE_URL || "https://api.instantly.ai/api/v2",
  instantlyCampaignsEndpoint:
    process.env.INSTANTLY_CAMPAIGNS_ENDPOINT || "/campaigns",
  instantlyCampaignActivateEndpoint:
    process.env.INSTANTLY_CAMPAIGN_ACTIVATE_ENDPOINT ||
    "/campaigns/:campaignId/activate",
  instantlyLeadsEndpoint: process.env.INSTANTLY_LEADS_ENDPOINT || "/leads",
  instantlyPageLimit: numberEnv(process.env.INSTANTLY_PAGE_LIMIT, 100),

  maxVideosPerSeed: numberEnv(process.env.MAX_VIDEOS_PER_SEED, 100),
  maxChannelsPerSeed: numberEnv(process.env.MAX_CHANNELS_PER_SEED, 250),
  maxVideosPerChannel: numberEnv(process.env.MAX_VIDEOS_PER_CHANNEL, 100),
  videoLookbackDays: numberEnv(process.env.VIDEO_LOOKBACK_DAYS, 90),
  recentSponsorshipDays: numberEnv(process.env.RECENT_SPONSORSHIP_DAYS, 30),
  statsUpdateDays: numberEnv(process.env.STATS_UPDATE_DAYS, 180),

  minSubscribers: numberEnv(process.env.MIN_SUBSCRIBERS, 1000),
  maxSubscribers: numberEnv(process.env.MAX_SUBSCRIBERS, 25000000),
  searchKeywords: listEnv(process.env.SEARCH_KEYWORDS || "review,sponsored,unboxing"),

  maxContactsPerBrand: numberEnv(process.env.MAX_CONTACTS_PER_BRAND, 20),
  maxDiscoveryBrandsPerRun: numberEnv(process.env.MAX_DISCOVERY_BRANDS_PER_RUN, 100),
  maxVerificationPerRun: numberEnv(process.env.MAX_VERIFICATION_PER_RUN, 500),
  maxInstantlyPushPerRun: numberEnv(process.env.MAX_INSTANTLY_PUSH_PER_RUN, 160),

  apolloMaxResults: numberEnv(process.env.APOLLO_MAX_RESULTS, 100),
  apolloPerPage: numberEnv(process.env.APOLLO_PER_PAGE, 25),
  hunterMaxResults: numberEnv(process.env.HUNTER_MAX_RESULTS, 100),
  hunterLimit: numberEnv(process.env.HUNTER_LIMIT, 10),
  prospeoMaxRetries: numberEnv(process.env.PROSPEO_MAX_RETRIES, 3),
  prospeoRequestDelayMs: numberEnv(process.env.PROSPEO_REQUEST_DELAY_MS, 1500),
  prospeoRetryDelayMs: numberEnv(process.env.PROSPEO_RETRY_DELAY_MS, 3000),

  defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
  defaultCampaignStartHour: numberEnv(process.env.DEFAULT_CAMPAIGN_START_HOUR, 9),
  defaultCampaignEndHour: numberEnv(process.env.DEFAULT_CAMPAIGN_END_HOUR, 16),
  defaultDailyLeadLimit: numberEnv(process.env.DEFAULT_DAILY_LEAD_LIMIT, 160),
  defaultLeadsPerSender: numberEnv(process.env.DEFAULT_LEADS_PER_SENDER, 16),
  defaultFollowup1Days: numberEnv(process.env.DEFAULT_FOLLOWUP_1_DAYS, 2),
  defaultFollowup2Days: numberEnv(process.env.DEFAULT_FOLLOWUP_2_DAYS, 5),
  emailGapMinutes: numberEnv(process.env.EMAIL_GAP_MINUTES, 5),
  randomWaitMaxMinutes: numberEnv(process.env.RANDOM_WAIT_MAX_MINUTES, 3),
  skipWeekends: booleanEnv(process.env.SKIP_WEEKENDS, true),

  enoylitySenders: listEnv(process.env.ENOYLITY_SENDERS),
  mhdSenders: listEnv(process.env.MHD_SENDERS),

  logLevel: process.env.LOG_LEVEL || "debug"
};