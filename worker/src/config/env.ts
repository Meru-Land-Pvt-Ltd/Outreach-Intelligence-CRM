import dotenv from "dotenv";

dotenv.config();

function numberValue(value: any, fallback: number) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function booleanValue(value: any, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function listValue(value: any) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  workerName: process.env.WORKER_NAME || "outreach-intelligence-worker",

  mongodbUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm",

  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: numberValue(process.env.REDIS_PORT, 6379),
  redisPassword: process.env.REDIS_PASSWORD || "",

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiChatCompletionsUrl:
    process.env.OPENAI_CHAT_COMPLETIONS_URL ||
    "https://api.openai.com/v1/chat/completions",

  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  youtubeApiKeys: listValue(process.env.YOUTUBE_API_KEYS),
  youtubeSearchBaseUrl:
    process.env.YOUTUBE_SEARCH_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/search",
  youtubeVideosBaseUrl:
    process.env.YOUTUBE_VIDEOS_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/videos",
  youtubeChannelsBaseUrl:
    process.env.YOUTUBE_CHANNELS_BASE_URL ||
    "https://www.googleapis.com/youtube/v3/channels",

  instantlyApiKey: process.env.INSTANTLY_API_KEY || "",
  instantlyBaseUrl:
    process.env.INSTANTLY_BASE_URL || "https://api.instantly.ai/api/v2",
  instantlyAutoActivate: booleanValue(process.env.INSTANTLY_AUTO_ACTIVATE, false),
  instantlySenderEmails: listValue(process.env.INSTANTLY_SENDER_EMAILS),
  instantlyCampaignPrefix:
    process.env.INSTANTLY_CAMPAIGN_PREFIX || "CollabGlam Outreach",
  instantlyTemplateSubject:
    process.env.INSTANTLY_TEMPLATE_SUBJECT ||
    "Collaboration opportunity with {{companyName}}",
  instantlyTemplateBody:
    process.env.INSTANTLY_TEMPLATE_BODY ||
    "Hi {{firstName}},\n\nWould you be open to discussing a creator collaboration?\n\nBest,\nCollabGlam",
  instantlyEmailGapMinutes: numberValue(process.env.INSTANTLY_EMAIL_GAP_MINUTES, 10),
  instantlyRandomWaitMaxMinutes: numberValue(
    process.env.INSTANTLY_RANDOM_WAIT_MAX_MINUTES,
    10
  ),
  instantlyStopOnReply: booleanValue(process.env.INSTANTLY_STOP_ON_REPLY, true),
  instantlyOpenTracking: booleanValue(process.env.INSTANTLY_OPEN_TRACKING, true),
  instantlyLinkTracking: booleanValue(process.env.INSTANTLY_LINK_TRACKING, true),
  instantlyDailyLimit: numberValue(process.env.INSTANTLY_DAILY_LIMIT, 160),
  instantlyDailyMaxLeads: numberValue(process.env.INSTANTLY_DAILY_MAX_LEADS, 160),
  instantlyLimitEmailsPerCompany: numberValue(
    process.env.INSTANTLY_LIMIT_EMAILS_PER_COMPANY,
    2
  ),

  millionVerifierApiKey: process.env.MILLION_VERIFIER_API_KEY || "",
  millionVerifierBaseUrl:
    process.env.MILLION_VERIFIER_BASE_URL ||
    "https://api.millionverifier.com/api/v3/",
  millionVerifierTimeout: numberValue(process.env.MILLION_VERIFIER_TIMEOUT, 20),

  hunterApiKey: process.env.HUNTER_API_KEY || "",
  hunterBaseUrl: process.env.HUNTER_BASE_URL || "https://api.hunter.io/v2",
  hunterDomainSearchEndpoint:
    process.env.HUNTER_DOMAIN_SEARCH_ENDPOINT || "/domain-search",
  hunterLimit: numberValue(process.env.HUNTER_LIMIT, 10),

  apolloApiKey: process.env.APOLLO_API_KEY || "",
  apolloBaseUrl: process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1",
  apolloPeopleSearchEndpoint:
    process.env.APOLLO_PEOPLE_SEARCH_ENDPOINT || "/mixed_people/api_search",
  apolloPeopleEnrichEndpoint:
    process.env.APOLLO_PEOPLE_ENRICH_ENDPOINT || "/people/match",
  apolloPerPage: numberValue(process.env.APOLLO_PER_PAGE, 10),

  prospeoApiKey: process.env.PROSPEO_API_KEY || "",
  prospeoBaseUrl: process.env.PROSPEO_BASE_URL || "https://api.prospeo.io",
  prospeoSearchPersonEndpoint:
    process.env.PROSPEO_SEARCH_PERSON_ENDPOINT || "/search-person",
  prospeoEnrichPersonEndpoint:
    process.env.PROSPEO_ENRICH_PERSON_ENDPOINT || "/enrich-person",
  prospeoRequestDelayMs: numberValue(process.env.PROSPEO_REQUEST_DELAY_MS, 1500),
  prospeoOnlyVerifiedEmail: booleanValue(
    process.env.PROSPEO_ONLY_VERIFIED_EMAIL,
    false
  ),
  prospeoSearchPages: numberValue(process.env.PROSPEO_SEARCH_PAGES, 3),

  maxVideosPerSeed: numberValue(process.env.MAX_VIDEOS_PER_SEED, 20),
  maxChannelsPerSeed: numberValue(process.env.MAX_CHANNELS_PER_SEED, 50),
  maxVideosPerChannel: numberValue(process.env.MAX_VIDEOS_PER_CHANNEL, 20),
  videoLookbackDays: numberValue(process.env.VIDEO_LOOKBACK_DAYS, 90),
  recentSponsorshipDays: numberValue(process.env.RECENT_SPONSORSHIP_DAYS, 30),

  minSubscribers: numberValue(process.env.MIN_SUBSCRIBERS, 1000),
  maxSubscribers: numberValue(process.env.MAX_SUBSCRIBERS, 1000000),

  maxContactsPerBrand: numberValue(process.env.MAX_CONTACTS_PER_BRAND, 20),
  maxDiscoveryBrandsPerRun: numberValue(
    process.env.MAX_DISCOVERY_BRANDS_PER_RUN,
    100
  ),
  maxVerificationPerRun: numberValue(process.env.MAX_VERIFICATION_PER_RUN, 500),
  maxInstantlyPushPerRun: numberValue(process.env.MAX_INSTANTLY_PUSH_PER_RUN, 160),

  defaultTimezone: process.env.DEFAULT_TIMEZONE || "UTC",
  defaultCampaignStartHour: numberValue(process.env.DEFAULT_CAMPAIGN_START_HOUR, 9),
  defaultCampaignEndHour: numberValue(process.env.DEFAULT_CAMPAIGN_END_HOUR, 16),
  defaultDailyLeadLimit: numberValue(process.env.DEFAULT_DAILY_LEAD_LIMIT, 160),
  defaultLeadsPerSender: numberValue(process.env.DEFAULT_LEADS_PER_SENDER, 16),
  defaultFollowup1Days: numberValue(process.env.DEFAULT_FOLLOWUP_1_DAYS, 2),
  defaultFollowup2Days: numberValue(process.env.DEFAULT_FOLLOWUP_2_DAYS, 5),
  skipWeekends: booleanValue(process.env.SKIP_WEEKENDS, true),

  logLevel: process.env.LOG_LEVEL || "debug"
};
