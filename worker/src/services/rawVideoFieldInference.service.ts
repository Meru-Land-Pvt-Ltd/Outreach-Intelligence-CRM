type RawVideoLike = {
  seedBrandName?: string;
  channelName?: string;
  videoTitle?: string;
  videoDescription?: string;
  durationSec?: number;
  raw?: any;
};

export type RawVideoExtractedFields = {
  channelCategory: string;
  sponsorBrand: string;
  promoCode: string;
  productNameWithModel: string;
  sponsorshipType: string;
};

const INVALID_SPONSOR_VALUES = new Set([
  "",
  "-",
  "n/a",
  "na",
  "none",
  "unknown",
  "no sponsor",
  "pending ai analysis"
]);

const KNOWN_CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  {
    pattern:
      /anker\s+solix|power\s*station|backup\s*power|home\s*backup|outage|battery\s*capacity|solar\s*generator|portable\s*power/i,
    category: "Portable Power"
  },
  {
    pattern: /gaming\s*chair|ergonomic\s*chair|office\s*chair|desk\s*chair/i,
    category: "Furniture"
  },
  {
    pattern: /earbuds|headphones|speaker|audio|soundbar|microphone/i,
    category: "Audio"
  },
  {
    pattern: /laptop|monitor|mini\s*pc|keyboard|mouse|charging|charger|gadget|tech/i,
    category: "Tech"
  },
  {
    pattern: /camping|outdoor|hiking|rv|overland/i,
    category: "Outdoor"
  },
  {
    pattern: /robot\s*lawn|lawn\s*mower|garden|yard/i,
    category: "Garden"
  }
];

const KNOWN_PRODUCT_RULES: Array<[RegExp, string]> = [
  [/Anker\s+SOLIX\s+F3800\s*(?:Plus|\+)?/i, "Anker SOLIX F3800 Plus"],
  [/\bF3800\s*(?:Plus|\+)\b/i, "Anker SOLIX F3800 Plus"],
  [/Anker\s+SOLIX\s+S2000/i, "Anker SOLIX S2000"],
  [/\bS2000\b/i, "Anker SOLIX S2000"],
  [/Anker\s+SOLIX\s+C800\s*\+?/i, "Anker SOLIX C800+"],
  [/\bSOLIX\s+C800\s*\+?\b/i, "Anker SOLIX C800+"],
  [/Anker\s+SOLIX\s+C1000\b/i, "Anker SOLIX C1000"],
  [/\bSOLIX\s+C1000\b/i, "Anker SOLIX C1000"],
  [/Anker\s+SOLIX\s+F2000\b/i, "Anker SOLIX F2000"],
  [/\bSOLIX\s+F2000\b/i, "Anker SOLIX F2000"],
  [/Doro\s+C300/i, "Doro C300"],
  [/Sihoo\s+Doro\s+C300/i, "Sihoo Doro C300"]
];

export function cleanRawVideoValue(value: any) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBlankishRawVideoValue(value: any) {
  const text = cleanRawVideoValue(value).toLowerCase();
  return !text || text === "-" || text === "pending" || text === "pending ai analysis";
}

export function isMissingMeaningfulRawVideoValue(value: any) {
  const text = cleanRawVideoValue(value).toLowerCase();
  return (
    isBlankishRawVideoValue(value) ||
    text === "n/a" ||
    text === "na" ||
    text === "none" ||
    text === "unknown"
  );
}

export function isValidSponsorBrand(value: any) {
  return !INVALID_SPONSOR_VALUES.has(cleanRawVideoValue(value).toLowerCase());
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedIncludes(haystack: string, needle: string) {
  const normalizedHaystack = haystack.toLowerCase();
  const normalizedNeedle = needle.toLowerCase();

  return Boolean(normalizedNeedle && normalizedHaystack.includes(normalizedNeedle));
}

export function getRawVideoText(video: RawVideoLike) {
  return [
    video.seedBrandName,
    video.channelName,
    video.videoTitle,
    video.videoDescription,
    video.raw?.foundViaSeedBrand,
    video.raw?.seedProductName
  ]
    .map(cleanRawVideoValue)
    .filter(Boolean)
    .join(" ");
}

function inferCategory(video: RawVideoLike, aiCategory?: string) {
  if (!isMissingMeaningfulRawVideoValue(aiCategory)) {
    return cleanRawVideoValue(aiCategory);
  }

  const text = getRawVideoText(video);

  for (const rule of KNOWN_CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }

  return "Uncategorized";
}

function inferPromoCode(video: RawVideoLike, aiPromoCode?: string) {
  const aiValue = cleanRawVideoValue(aiPromoCode);

  if (
    aiValue &&
    !isMissingMeaningfulRawVideoValue(aiValue) &&
    !/^https?:\/\//i.test(aiValue)
  ) {
    return aiValue;
  }

  const text = getRawVideoText(video);
  const patterns = [
    /(?:promo|coupon|discount)\s*code\s*(?:is|:|-)?\s*([A-Z0-9][A-Z0-9_-]{2,30})/i,
    /use\s+code\s+([A-Z0-9][A-Z0-9_-]{2,30})/i,
    /code\s*[:：]\s*([A-Z0-9][A-Z0-9_-]{2,30})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return "N/A";
}

function inferProductName(video: RawVideoLike, aiProduct?: string) {
  if (!isMissingMeaningfulRawVideoValue(aiProduct)) {
    return cleanRawVideoValue(aiProduct);
  }

  const text = getRawVideoText(video).replace(/\s+/g, " ");
  const seedProduct = cleanRawVideoValue(video.raw?.seedProductName);

  if (seedProduct && normalizedIncludes(text, seedProduct)) {
    return seedProduct;
  }

  for (const [pattern, product] of KNOWN_PRODUCT_RULES) {
    if (pattern.test(text)) return product;
  }

  const ankerGeneric = text.match(/\bAnker\s+SOLIX\s+([A-Z][A-Z0-9+-]{2,20})\b/i);
  if (ankerGeneric?.[1]) return "Anker SOLIX " + ankerGeneric[1].toUpperCase();

  const brandModel = text.match(
    /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}\s+[A-Z]{0,4}\d{2,5}[A-Z0-9+\-]*)\b/
  );

  if (brandModel?.[1]) {
    return cleanRawVideoValue(brandModel[1]);
  }

  return "N/A";
}

function inferSponsorBrand(video: RawVideoLike, aiSponsorBrand?: string) {
  if (isValidSponsorBrand(aiSponsorBrand)) {
    return cleanRawVideoValue(aiSponsorBrand);
  }

  const text = getRawVideoText(video);
  const lowerText = text.toLowerCase();
  const seedBrand = cleanRawVideoValue(video.seedBrandName || video.raw?.foundViaSeedBrand);
  const channelName = cleanRawVideoValue(video.channelName);

  if (lowerText.includes("anker solix") || lowerText.includes("#ankersolix")) {
    return "Anker SOLIX";
  }

  if (seedBrand && normalizedIncludes(text, seedBrand)) {
    return seedBrand;
  }

  if (seedBrand && channelName) {
    const seedBrandPattern = new RegExp("\\b" + escapeRegex(seedBrand) + "\\b", "i");
    if (seedBrandPattern.test(channelName)) return channelName;
  }

  return "N/A";
}

function inferSponsorshipType(
  video: RawVideoLike,
  sponsorBrand: string,
  aiSponsorshipType?: string
) {
  const title = cleanRawVideoValue(video.videoTitle).toLowerCase();
  const description = cleanRawVideoValue(video.videoDescription).toLowerCase();
  const channelName = cleanRawVideoValue(video.channelName).toLowerCase();
  const seedBrand = cleanRawVideoValue(video.seedBrandName || video.raw?.foundViaSeedBrand).toLowerCase();
  const durationSec = Number(video.durationSec || 0);

  if (!isValidSponsorBrand(sponsorBrand)) return "N/A";
  if (title.includes("unboxing")) return "Unboxing";
  if (title.includes("comparison") || title.includes(" vs ")) return "Comparison";

  if (
    channelName.includes("anker solix") ||
    (seedBrand && channelName.includes(seedBrand)) ||
    description.includes("learn more") ||
    description.includes("early-bird") ||
    description.includes("going live") ||
    description.includes("official global partner") ||
    description.includes("introducing")
  ) {
    return "Official Brand Promo";
  }

  if (!isMissingMeaningfulRawVideoValue(aiSponsorshipType)) {
    return cleanRawVideoValue(aiSponsorshipType);
  }

  if (durationSec >= 300) return "Dedicated Review";
  return "Mention";
}

export function inferRawVideoFields(
  video: RawVideoLike,
  ai?: Partial<RawVideoExtractedFields>
): RawVideoExtractedFields {
  const sponsorBrand = inferSponsorBrand(video, ai?.sponsorBrand);
  const channelCategory = inferCategory(video, ai?.channelCategory);
  const promoCode = inferPromoCode(video, ai?.promoCode);
  const productNameWithModel = inferProductName(video, ai?.productNameWithModel);
  const sponsorshipType = inferSponsorshipType(video, sponsorBrand, ai?.sponsorshipType);

  return {
    channelCategory,
    sponsorBrand,
    promoCode,
    productNameWithModel,
    sponsorshipType
  };
}

export function buildRawVideoFieldSet(fields: RawVideoExtractedFields) {
  return {
    channelCategory: fields.channelCategory,
    category: fields.channelCategory,
    sponsorBrand: fields.sponsorBrand,
    promoCode: fields.promoCode,
    productNameWithModel: fields.productNameWithModel,
    productName: fields.productNameWithModel,
    sponsorshipType: fields.sponsorshipType,
    isSponsored: isValidSponsorBrand(fields.sponsorBrand)
  };
}

export function blankRawVideoAiFieldFilter() {
  return {
    $or: [
      { channelCategory: { $exists: false } },
      { channelCategory: null },
      { channelCategory: /^\s*$/ },
      { channelCategory: /^\s*-\s*$/ },
      { category: { $exists: false } },
      { category: null },
      { category: /^\s*$/ },
      { category: /^\s*-\s*$/ },
      { sponsorBrand: { $exists: false } },
      { sponsorBrand: null },
      { sponsorBrand: /^\s*$/ },
      { sponsorBrand: /^\s*-\s*$/ },
      { promoCode: { $exists: false } },
      { promoCode: null },
      { promoCode: /^\s*$/ },
      { promoCode: /^\s*-\s*$/ },
      { productNameWithModel: { $exists: false } },
      { productNameWithModel: null },
      { productNameWithModel: /^\s*$/ },
      { productNameWithModel: /^\s*-\s*$/ },
      { sponsorshipType: { $exists: false } },
      { sponsorshipType: null },
      { sponsorshipType: /^\s*$/ },
      { sponsorshipType: /^\s*-\s*$/ }
    ]
  };
}
