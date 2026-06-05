import axios from "axios";
import { EmailDiscovery } from "../models/EmailDiscovery.model";
import { callOpenAIWithWebSearch } from "./openaiResponses.service";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const JUNK_PATTERNS = [
  "example.com",
  "sentry",
  "webpack",
  "google.com",
  "youtube.com",
  "schema.org",
  "gstatic",
  "googleapis",
  "w3.org",
  "noreply",
  "no-reply",
  "wixpress",
  "cloudflare"
];

const URL_BLACKLIST = [
  "facebook.com/tr",
  "facebook.com/login",
  "facebook.com/sharer",
  "facebook.com/dialog",
  "facebook.com/share",
  "instagram.com/accounts",
  "instagram.com/p/",
  "instagram.com/reel/",
  "instagram.com/explore",
  "twitter.com/intent",
  "twitter.com/share",
  "x.com/intent",
  "x.com/share",
  "linkedin.com/shareArticle",
  "linkedin.com/share"
];

function cleanDomain(domain: string) {
  return String(domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function isBlacklistedUrl(url: string) {
  const lower = String(url || "").toLowerCase();
  return URL_BLACKLIST.some((item) => lower.includes(item));
}

function uniqueArray(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const clean = String(item || "").trim();

    if (!clean) continue;

    const key = clean.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(clean);
  }

  return result;
}

function filterJunkEmails(emails: string[]) {
  return emails.filter((email) => {
    const lower = email.toLowerCase();

    if (email.length < 6) return false;

    return !JUNK_PATTERNS.some((pattern) => lower.includes(pattern));
  });
}

function parseEmailsFromAI(aiResponse: string) {
  if (!aiResponse) return [];

  try {
    const cleaned = aiResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      return filterJunkEmails(parsed);
    }
  } catch {
    const found = aiResponse.match(EMAIL_REGEX) || [];
    return filterJunkEmails(found);
  }

  return [];
}

async function fetchWebsiteHtml(domain: string) {
  try {
    const response = await axios.get("https://" + domain, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      validateStatus: (status) => status >= 200 && status < 500
    });

    if (response.status === 200 && typeof response.data === "string") {
      return response.data;
    }
  } catch (error: any) {
    console.log("Could not fetch website:", error.message);
  }

  return "";
}

async function findSocialUrls(brandName: string, domain: string) {
  const html = await fetchWebsiteHtml(domain);

  let instagram: string | null = null;
  let twitter: string | null = null;
  let facebook: string | null = null;
  let linkedin: string | null = null;
  let youtube: string[] = [];

  if (html) {
    const igMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/g);
    if (igMatch) {
      const igUrl = igMatch[0].replace(/\/$/, "");
      if (!isBlacklistedUrl(igUrl)) instagram = igUrl;
    }

    const twMatch = html.match(/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?/g);
    if (twMatch) {
      const twUrl = twMatch[0].replace(/\/$/, "");
      if (!isBlacklistedUrl(twUrl)) twitter = twUrl;
    }

    const fbMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+\/?/g);
    if (fbMatch) {
      const fbUrl = fbMatch[0].replace(/\/$/, "");
      if (!isBlacklistedUrl(fbUrl)) facebook = fbUrl;
    }

    const liMatch = html.match(/https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/g);
    if (liMatch) {
      const liUrl = liMatch[0].replace(/\/$/, "");
      if (!isBlacklistedUrl(liUrl)) linkedin = liUrl;
    }

    const ytMatches = html.match(/https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)[a-zA-Z0-9_-]+\/?/g);
    if (ytMatches) {
      youtube = uniqueArray(
        ytMatches
          .map((url) => url.replace(/\/$/, ""))
          .filter((url) => !isBlacklistedUrl(url))
      );
    }
  }

  const missing: string[] = [];

  if (!instagram) missing.push("Instagram");
  if (!twitter) missing.push("Twitter/X");
  if (!facebook) missing.push("Facebook");
  if (!linkedin) missing.push("LinkedIn");

  missing.push(
    "YouTube (find ALL channels including regional ones with '" +
      brandName +
      "' in the channel name)"
  );

  if (missing.length > 0) {
    const systemPrompt =
      "Find the official social media profiles for the brand '" +
      brandName +
      "' (" +
      domain +
      "). " +
      "I need ONLY these platforms: " +
      missing.join(", ") +
      ". " +
      "Search the web and find the correct official profile URLs. Do NOT guess. " +
      "For YouTube, find ALL channels (including regional ones with the brand name). " +
      "Return ONLY valid JSON (no markdown):\n" +
      '{"instagram": "url or null", "twitter": "url or null", "facebook": "url or null", "linkedin": "url or null", "youtube": ["url1", "url2"]}';

    const userPrompt =
      "Find the official " +
      missing.join(", ") +
      " for " +
      brandName +
      " (" +
      domain +
      ")";

    const aiResponse = await callOpenAIWithWebSearch(systemPrompt, userPrompt);

    try {
      const cleaned = aiResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      if (!instagram && parsed.instagram) instagram = parsed.instagram;
      if (!twitter && parsed.twitter) twitter = parsed.twitter;
      if (!facebook && parsed.facebook) facebook = parsed.facebook;
      if (!linkedin && parsed.linkedin) linkedin = parsed.linkedin;

      if (parsed.youtube && parsed.youtube.length > 0) {
        youtube = uniqueArray([...youtube, ...parsed.youtube]);
      }
    } catch {
      console.log("Failed to parse AI fallback social URLs:", aiResponse);
    }
  }

  return {
    instagram,
    twitter,
    facebook,
    linkedin,
    youtube
  };
}

async function extractEmailsFromSource(url: string | null, brandName: string, platform: string) {
  if (!url) return "Not found";

  const systemPrompt =
    "You are an email extraction specialist. Visit the following " +
    platform +
    " page for the brand '" +
    brandName +
    "'. " +
    "Look at the bio, about section, description, contact info, and any visible text on the page. " +
    "Extract ALL email addresses you can find. Include obfuscated emails (like 'name at domain dot com', 'name [at] domain [dot] com') — convert them to standard format. " +
    "Return ONLY a JSON array of email strings. If no emails found, return [].";

  const userPrompt =
    "Visit this " + platform + " page and find all email addresses: " + url;

  const aiResponse = await callOpenAIWithWebSearch(systemPrompt, userPrompt);
  const emails = uniqueArray(parseEmailsFromAI(aiResponse));

  if (emails.length > 0) {
    return url + "\n" + emails.join("\n");
  }

  return url + "\n(No emails found)";
}

async function extractEmailsFromWebsite(domain: string) {
  const systemPrompt =
    "IMPORTANT: You MUST use web search to visit EACH of these URLs one by one: " +
    "https://" +
    domain +
    ", https://" +
    domain +
    "/contact, https://" +
    domain +
    "/contact-us, " +
    "https://" +
    domain +
    "/about, https://" +
    domain +
    "/about-us, https://" +
    domain +
    "/partnerships, " +
    "https://" +
    domain +
    "/creators, https://" +
    domain +
    "/influencers. " +
    "Do NOT skip any page. Do NOT guess. Actually visit each URL and read the page content. " +
    "Extract ALL email addresses you find on ALL pages. Include obfuscated emails (like 'name at domain dot com') — convert them to standard format. " +
    "Return ONLY a JSON array of unique email strings (no duplicates). If no emails found, return [].";

  const userPrompt =
    "Visit ALL these pages and extract every email address: https://" +
    domain +
    ", https://" +
    domain +
    "/contact, https://" +
    domain +
    "/contact-us, https://" +
    domain +
    "/about, https://" +
    domain +
    "/about-us, https://" +
    domain +
    "/partnerships, https://" +
    domain +
    "/creators, https://" +
    domain +
    "/influencers";

  const aiResponse = await callOpenAIWithWebSearch(systemPrompt, userPrompt);
  const emails = uniqueArray(parseEmailsFromAI(aiResponse));

  if (emails.length > 0) {
    return "https://" + domain + "\n" + emails.join("\n");
  }

  return "https://" + domain + "\n(No emails found)";
}

function collectEmailsFromCells(cells: string[]) {
  const emails: string[] = [];

  for (const cell of cells) {
    const lines = String(cell || "").split("\n");

    for (const line of lines) {
      const clean = line.trim();

      if (
        clean.match(EMAIL_REGEX) &&
        !clean.includes("(No emails") &&
        !clean.includes("http") &&
        !clean.includes("Not found")
      ) {
        emails.push(...(clean.match(EMAIL_REGEX) || []));
      }
    }
  }

  return filterJunkEmails(uniqueArray(emails));
}

export async function discoverEmailsForBrand(brandName: string, inputDomain: string) {
  const domain = cleanDomain(inputDomain);

  const row = await EmailDiscovery.findOne({
    brandName,
    domain
  });

  if (row?.instagram && String(row.instagram).trim() !== "") {
    return { skipped: true };
  }

  const socialUrls = await findSocialUrls(brandName, domain);

  const instagram = await extractEmailsFromSource(
    socialUrls.instagram,
    brandName,
    "Instagram"
  );

  const twitter = await extractEmailsFromSource(
    socialUrls.twitter,
    brandName,
    "Twitter/X"
  );

  const facebook = await extractEmailsFromSource(
    socialUrls.facebook,
    brandName,
    "Facebook"
  );

  const linkedin = await extractEmailsFromSource(
    socialUrls.linkedin,
    brandName,
    "LinkedIn"
  );

  const youtubeParts: string[] = [];

  for (const url of socialUrls.youtube || []) {
    youtubeParts.push(await extractEmailsFromSource(url, brandName, "YouTube"));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const youtube = youtubeParts.length > 0 ? youtubeParts.join("\n\n") : "Not found";
  const website = await extractEmailsFromWebsite(domain);

  const totalEmails = collectEmailsFromCells([
    instagram,
    twitter,
    facebook,
    linkedin,
    youtube,
    website
  ]);

  await EmailDiscovery.findOneAndUpdate(
    {
      brandName,
      domain
    },
    {
      $set: {
        brandName,
        domain,
        instagram,
        twitter,
        facebook,
        linkedin,
        youtube,
        website,
        totalEmails:
          totalEmails.length > 0
            ? totalEmails.join("\n")
            : "(No emails found)",
        status: "email_discovery_done"
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  return {
    totalEmails: totalEmails.length
  };
}
