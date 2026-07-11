import axios from "axios";

import { BrandMap } from "../models/BrandMap.model";
import { Contact } from "../models/Contact.model";
import { EmailDiscovery } from "../models/EmailDiscovery.model";
import { HunterRawContact } from "../models/HunterRawContact.model";
import { ApolloRawContact } from "../models/ApolloRawContact.model";
import { ProspeoRawContact } from "../models/ProspeoRawContact.model";
import { PipelineTracker } from "../models/PipelineTracker.model";
import { logDone, logError } from "./runLog.service";
import { searchProspeoContacts } from "./prospeo.service";
import { getAppSettings, AppSettings } from "./appSettings.service";
import {
  ProviderContact,
  buildApolloPocSelectionPrompt,
  buildRoleMatchers,
  selectProviderContacts
} from "./roleSelection.service";

const BrandMapModel = BrandMap as any;
const ContactModel = Contact as any;
const EmailDiscoveryModel = EmailDiscovery as any;
const HunterRawContactModel = HunterRawContact as any;
const ApolloRawContactModel = ApolloRawContact as any;
const ProspeoRawContactModel = ProspeoRawContact as any;
const PipelineTrackerModel = PipelineTracker as any;

type SourceResult = {
  url: string;
  emails: string[];
};

type DiscoveryResult = {
  instagram: SourceResult;
  twitter: SourceResult;
  facebook: SourceResult;
  linkedin: SourceResult;
  youtube: SourceResult;
  website: SourceResult;
};

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

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
  "donotreply",
  "wixpress",
  "cloudflare",
  "localhost",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".gif"
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
  "linkedin.com/sharearticle",
  "linkedin.com/share"
];

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/^u003e/, "")
    .replace(/[<>"'(),;]+/g, "")
    .trim();
}

function normalizeDomain(value: any) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .replace(/\/$/, "")
    .trim();
}

function isBlacklistedUrl(url: string) {
  const lower = String(url || "").toLowerCase();

  return URL_BLACKLIST.some((bad) => lower.includes(bad));
}

// Asset/code files that the page scraper can mistake for emails, e.g.
// "swiper@12.min.css", "ecom-swiper@11.0.5.js", "<hash>@origin.ico".
const ASSET_EMAIL_REGEX =
  /(\.(css|js|mjs|cjs|ts|json|map|scss|less|png|jpe?g|svg|webp|gif|woff2?|ttf|otf|eot|ico|mp4|webm|mp3|wav|pdf|xml|yml|yaml)$)|(@\d+(\.\d+)*\.)|(\.min\.)/i;

function isValidEmail(email: string) {
  if (!email) return false;

  const lower = email.toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return false;

  // Reject versioned/minified asset references (CDN paths parsed as emails).
  if (ASSET_EMAIL_REGEX.test(lower)) return false;

  // The TLD must be alphabetic (2+ letters) — "12.min.css" style domains fail.
  const tld = lower.split(".").pop() || "";
  if (!/^[a-z]{2,}$/.test(tld)) return false;

  return !JUNK_PATTERNS.some((junk) => lower.includes(junk));
}

function normalizeProviderStatus(value: any, hasEmail = false) {
  const raw = cleanText(value);
  const lower = raw.toLowerCase().replace(/[\s_-]+/g, " ").trim();

  if (!lower) return hasEmail ? "Verified" : "";

  if (["verified", "valid", "ok", "deliverable", "accepted"].includes(lower)) {
    return "Verified";
  }

  if (["revealed", "found", "available"].includes(lower)) {
    return "Revealed";
  }

  if (["has email", "hasemail", "has emails", "true"].includes(lower)) {
    return "Has Email";
  }

  if (
    ["no email", "no emails", "no email found", "not found", "unavailable", "false"].includes(
      lower
    )
  ) {
    return "No Email";
  }

  if (["invalid", "failed", "error", "undeliverable", "rejected"].includes(lower)) {
    return "Invalid";
  }

  return raw;
}

function normalizeHunterEmailStatus(value: any, hasEmail = false) {
  const raw = cleanText(value);
  const lower = raw.toLowerCase().replace(/[\s_-]+/g, " ").trim();

  if (!lower) return hasEmail ? "Yes" : "No";

  if (
    [
      "verified",
      "valid",
      "ok",
      "deliverable",
      "accepted",
      "accept all",
      "acceptall",
      "has email",
      "hasemail",
      "has emails",
      "true"
    ].includes(lower) ||
    /^\d+$/.test(lower)
  ) {
    return hasEmail ? "Yes" : "No";
  }

  if (
    [
      "invalid",
      "failed",
      "error",
      "undeliverable",
      "rejected",
      "no email",
      "no emails",
      "no email found",
      "not found",
      "unavailable",
      "false"
    ].includes(lower)
  ) {
    return "No";
  }

  return hasEmail ? "Yes" : "No";
}

function uniqueEmails(emails: string[]) {
  return Array.from(new Set(emails.map(cleanEmail))).filter(isValidEmail);
}

function extractEmails(text: string) {
  const matches = String(text || "").match(EMAIL_REGEX) || [];
  return uniqueEmails(matches);
}

function hasRealEmailCell(value: any) {
  return extractEmails(String(value || "")).length > 0;
}

function formatSourceCell(result: SourceResult) {
  const lines: string[] = [];

  if (result.url) {
    lines.push(result.url);
  } else {
    lines.push("Not found");
  }

  if (result.emails.length > 0) {
    lines.push(...result.emails);
  } else {
    lines.push("(No emails found)");
  }

  return lines.join("\n");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isGenericEmail(email: string) {
  const local = String(email || "").split("@")[0].toLowerCase();

  const words = [
    "hello",
    "support",
    "sales",
    "marketing",
    "contact",
    "info",
    "service",
    "media",
    "affiliate",
    "kol",
    "contentpartners",
    "influencer",
    "press",
    "pr",
    "team",
    "admin",
    "care",
    "help",
    "partners",
    "partnership",
    "partnerships",
    "business"
  ];

  return words.some(
    (word) =>
      local === word ||
      local.startsWith(word + ".") ||
      local.startsWith(word + "-") ||
      local.startsWith(word + "_")
  );
}

function inferFullName(email: string, brandName: string) {
  if (isGenericEmail(email)) return brandName + " Team";

  const local = email.split("@")[0].toLowerCase();

  const parts = local
    .replace(/\d+/g, "")
    .split(/[._-]/)
    .filter(Boolean)
    .filter((part) => part.length > 1);

  if (parts.length === 0) return brandName + " Team";

  return titleCase(parts.join(" "));
}

function inferRole(email: string) {
  const local = email.split("@")[0].toLowerCase();

  if (local.includes("influencer") || local.includes("kol")) {
    return "Influencer Marketing";
  }

  if (local.includes("affiliate")) return "Affiliate Marketing";

  if (
    local.includes("partner") ||
    local.includes("partnership") ||
    local.includes("contentpartner")
  ) {
    return "Partnerships";
  }

  if (local.includes("media") || local.includes("press") || local === "pr") {
    return "Media / PR";
  }

  if (local.includes("marketing")) return "Marketing";
  if (local.includes("sales")) return "Sales";
  if (local.includes("support") || local.includes("service")) return "Support";

  return "";
}

async function fetchHtml(url: string) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (response.status >= 200 && response.status < 500) {
      return String(response.data || "");
    }

    return "";
  } catch {
    return "";
  }
}

function firstMatch(html: string, regex: RegExp) {
  const matches = String(html || "").match(regex) || [];

  for (const match of matches) {
    const url = String(match || "").replace(/\/$/, "");

    if (url && !isBlacklistedUrl(url)) {
      return url;
    }
  }

  return "";
}

function allMatches(html: string, regex: RegExp) {
  const matches = String(html || "").match(regex) || [];
  const output: string[] = [];

  for (const match of matches) {
    const url = String(match || "").replace(/\/$/, "");

    if (url && !isBlacklistedUrl(url) && !output.includes(url)) {
      output.push(url);
    }
  }

  return output;
}

async function aiFindSocialUrls(
  brandName: string,
  domain: string,
  missing: string[]
): Promise<Record<string, string>> {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key || missing.length === 0) {
    return {};
  }

  const prompt =
    "Find the official social URLs for this brand.\n\n" +
    "Brand: " +
    brandName +
    "\nDomain: " +
    domain +
    "\nMissing platforms: " +
    missing.join(", ") +
    "\n\n" +
    "Return JSON only with keys instagram, twitter, facebook, linkedin, youtube. Use empty string if unsure.";

  try {
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Return valid JSON only." },
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

    let text = String(response.data?.choices?.[0]?.message?.content || "");
    text = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);

    return {
      instagram: cleanText(parsed.instagram),
      twitter: cleanText(parsed.twitter),
      facebook: cleanText(parsed.facebook),
      linkedin: cleanText(parsed.linkedin),
      youtube: cleanText(parsed.youtube)
    };
  } catch {
    return {};
  }
}

async function findSocialUrls(brandName: string, domain: string) {
  const html = await fetchHtml("https://" + domain);

  let instagram = firstMatch(
    html,
    /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/g
  );

  let twitter = firstMatch(
    html,
    /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?/g
  );

  let facebook = firstMatch(
    html,
    /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+\/?/g
  );

  let linkedin = firstMatch(
    html,
    /https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/g
  );

  const youtubeMatches = allMatches(
    html,
    /https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)[a-zA-Z0-9_-]+\/?/g
  );

  let youtube = youtubeMatches[0] || "";

  const missing: string[] = [];

  if (!instagram) missing.push("Instagram");
  if (!twitter) missing.push("Twitter/X");
  if (!facebook) missing.push("Facebook");
  if (!linkedin) missing.push("LinkedIn");
  if (!youtube) missing.push("YouTube");

  const aiUrls = await aiFindSocialUrls(brandName, domain, missing);

  instagram = instagram || cleanText(aiUrls.instagram);
  twitter = twitter || cleanText(aiUrls.twitter);
  facebook = facebook || cleanText(aiUrls.facebook);
  linkedin = linkedin || cleanText(aiUrls.linkedin);
  youtube = youtube || cleanText(aiUrls.youtube);

  return {
    instagram,
    twitter,
    facebook,
    linkedin,
    youtube,
    website: "https://" + domain
  };
}

async function extractEmailsFromUrl(url: string): Promise<SourceResult> {
  if (!url) {
    return {
      url: "",
      emails: []
    };
  }

  const html = await fetchHtml(url);

  return {
    url,
    emails: extractEmails(html)
  };
}

async function discoverWebsiteAndSocial(
  brandName: string,
  domain: string
): Promise<DiscoveryResult> {
  const socialUrls = await findSocialUrls(brandName, domain);

  return {
    instagram: await extractEmailsFromUrl(socialUrls.instagram),
    twitter: await extractEmailsFromUrl(socialUrls.twitter),
    facebook: await extractEmailsFromUrl(socialUrls.facebook),
    linkedin: await extractEmailsFromUrl(socialUrls.linkedin),
    youtube: await extractEmailsFromUrl(socialUrls.youtube),
    website: await extractEmailsFromUrl(socialUrls.website)
  };
}

async function saveContact(input: {
  brandName: string;
  domain: string;
  email: string;
  source: string;
  fullName?: string;
  designation?: string;
  raw?: any;
}) {
  const email = cleanEmail(input.email);

  if (!isValidEmail(email)) return false;

  const fullName = cleanText(input.fullName) || inferFullName(email, input.brandName);
  const role = cleanText(input.designation) || inferRole(email);

  await ContactModel.findOneAndUpdate(
    {
      brandName: input.brandName,
      email
    },
    {
      $setOnInsert: {
        brandName: input.brandName,
        domain: input.domain,
        email,
        fullName,
        firstName: fullName.split(/\s+/)[0],
        designation: role,
        role,
        source: input.source,
        status: "email_found",
        verificationStatus: "not_verified",
        raw: input.raw || {}
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  return true;
}

async function fetchHunterRows(domain: string, filtered: boolean) {
  const key = process.env.HUNTER_API_KEY || "";
  const baseUrl = process.env.HUNTER_BASE_URL || "https://api.hunter.io/v2";

  const params: Record<string, any> = {
    domain,
    api_key: key,
    limit: Number(process.env.HUNTER_LIMIT || 10)
  };

  if (filtered) {
    // Hunter's documented department/seniority enums; juniors excluded.
    params.department = "marketing,communication,management";
    params.seniority = "senior,executive";
  }

  const response = await axios.get(baseUrl + "/domain-search", {
    params,
    timeout: 30000,
    validateStatus: () => true
  });

  return response.data?.data?.emails || [];
}

async function discoverHunter(
  brandName: string,
  domain: string,
  settings: AppSettings
): Promise<ProviderContact[]> {
  const key = process.env.HUNTER_API_KEY || "";

  if (!key) return [];

  try {
    let rows = await fetchHunterRows(domain, true);

    // Filtered call found nobody — fall back to today's unfiltered behavior
    // so a mis-tagged org chart still yields contacts.
    if (!rows.length) {
      rows = await fetchHunterRows(domain, false);
    }

    const contacts: ProviderContact[] = [];

    for (const item of rows) {
      const email = cleanEmail(item.value);
      if (!isValidEmail(email)) continue;

      const fullName = cleanText(
        [item.first_name, item.last_name].filter(Boolean).join(" ")
      );

      await HunterRawContactModel.findOneAndUpdate(
        { brandName, domain, email },
        {
          $set: {
            brandName,
            domain,
            fullName,
            title: cleanText(item.position),
            country: cleanText(item.country),
            email,
            emailStatus: normalizeHunterEmailStatus(
              item.verification?.status || item.verification?.result || item.status || item.confidence,
              true
            ),
            raw: item
          }
        },
        { upsert: true, new: true }
      );

      contacts.push({
        email,
        fullName,
        role: cleanText(item.position),
        source: "hunter",
        raw: item
      });
    }

    return contacts;
  } catch {
    return [];
  }
}

// Role-filtered fallback when the AI POC selection is unavailable: drop
// exclude-list roles, prefer target-role matches, take the top 5.
function fallbackApolloPocSelection(people: any[], settings: AppSettings) {
  const matchers = buildRoleMatchers(settings);

  const eligible = people.filter(
    (p: any) => !matchers.exclude.some((rx) => rx.test(String(p.title || "")))
  );

  const targeted = eligible.filter((p: any) =>
    matchers.target.some((rx) => rx.test(String(p.title || "")))
  );

  return (targeted.length > 0 ? targeted : eligible).slice(0, 5);
}

async function aiSelectApolloPOCs(
  brandName: string,
  people: any[],
  settings: AppSettings
) {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key || people.length === 0) {
    return fallbackApolloPocSelection(people, settings);
  }

  const prompt = buildApolloPocSelectionPrompt(brandName, people, settings);

  try {
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Return valid JSON only." },
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

    let text = String(response.data?.choices?.[0]?.message?.content || "");
    text = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    const ids = new Set((parsed.ids || []).map(String));

    return people.filter((p) => ids.has(String(p.id))).slice(0, 5);
  } catch {
    return fallbackApolloPocSelection(people, settings);
  }
}

async function fetchApolloPeoplePage(
  domain: string,
  page: number,
  perPage: number,
  settings: AppSettings | null
) {
  const key = process.env.APOLLO_API_KEY || "";
  const baseUrl = process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1";

  const body: Record<string, any> = {
    q_organization_domains: domain,
    page,
    per_page: perPage
  };

  if (settings) {
    body.person_titles = settings.targetRoleKeywords;
    body.person_seniorities = [
      "manager",
      "senior",
      "head",
      "director",
      "vp",
      "owner",
      "partner"
    ];
  }

  const response = await axios.post(
    baseUrl +
      (process.env.APOLLO_PEOPLE_SEARCH_ENDPOINT || "/mixed_people/api_search"),
    body,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": key
      },
      timeout: 45000,
      validateStatus: () => true
    }
  );

  return response.data?.people || [];
}

async function discoverApollo(
  brandName: string,
  domain: string,
  settings: AppSettings
): Promise<ProviderContact[]> {
  const key = process.env.APOLLO_API_KEY || "";
  const baseUrl = process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1";

  if (!key) return [];

  try {
    const allPeople: any[] = [];
    const maxResults = Number(process.env.APOLLO_MAX_RESULTS || 100);
    const perPage = Number(process.env.APOLLO_PER_PAGE || 25);

    // Title/seniority-filtered search first; if the filters match nobody at
    // this domain, fall back to today's unfiltered pull.
    let useFilters = true;

    for (let page = 1; allPeople.length < maxResults; page += 1) {
      let people = await fetchApolloPeoplePage(
        domain,
        page,
        perPage,
        useFilters ? settings : null
      );

      if (!people.length && page === 1 && useFilters) {
        useFilters = false;
        people = await fetchApolloPeoplePage(domain, page, perPage, null);
      }

      if (!people.length) break;

      for (const person of people) {
        allPeople.push(person);

        const fullName = cleanText(
          person.name ||
            [person.first_name, person.last_name].filter(Boolean).join(" ")
        );

        await ApolloRawContactModel.findOneAndUpdate(
          {
            brandName,
            domain,
            apolloPersonId: String(person.id || "")
          },
          {
            $set: {
              brandName,
              domain,
              fullName,
              title: cleanText(person.title),
              email: isValidEmail(cleanEmail(person.email)) ? cleanEmail(person.email) : "",
              emailVerified: normalizeProviderStatus(
                person.email_status || person.email_verified || (person.has_email ? "Has Email" : "No Email"),
                isValidEmail(cleanEmail(person.email))
              ),
              apolloPersonId: String(person.id || ""),
              raw: person
            }
          },
          { upsert: true, new: true }
        );
      }

      if (people.length < perPage) break;
    }

    const selected = await aiSelectApolloPOCs(brandName, allPeople, settings);
    const contacts: ProviderContact[] = [];

    for (const person of selected) {
      let email = cleanEmail(person.email);

      if (!email) {
        try {
          const reveal = await axios.post(
            baseUrl +
              (process.env.APOLLO_BULK_MATCH_ENDPOINT || "/people/bulk_match"),
            {
              details: [
                {
                  id: person.id,
                  first_name: person.first_name,
                  last_name: person.last_name,
                  organization_name: brandName,
                  domain
                }
              ]
            },
            {
              headers: {
                "Content-Type": "application/json",
                "X-Api-Key": key
              },
              timeout: 45000,
              validateStatus: () => true
            }
          );

          email = cleanEmail(
            reveal.data?.matches?.[0]?.email ||
              reveal.data?.people?.[0]?.email ||
              reveal.data?.person?.email
          );
        } catch {
          // skip reveal failure
        }
      }

      const fullName = cleanText(
        person.name ||
          [person.first_name, person.last_name].filter(Boolean).join(" ")
      );

      if (email) {
        await ApolloRawContactModel.findOneAndUpdate(
          {
            brandName,
            domain,
            apolloPersonId: String(person.id || "")
          },
          {
            $set: {
              fullName,
              title: cleanText(person.title),
              email,
              emailVerified: normalizeProviderStatus(person.email_status || "Revealed", true)
            }
          }
        );

        contacts.push({
          email,
          fullName,
          role: cleanText(person.title),
          source: "apollo",
          raw: person
        });
      }
    }

    return contacts;
  } catch {
    return [];
  }
}

async function discoverProspeo(
  brandName: string,
  domain: string,
  settings: AppSettings
): Promise<ProviderContact[]> {
  if (!process.env.PROSPEO_API_KEY) return [];

  try {
    // Paid enrichment capped relative to the combined provider cap; role
    // titles come from the same settings list all providers share.
    const found = await searchProspeoContacts(domain, {
      titles: settings.targetRoleKeywords,
      maxContacts: Math.max(settings.providerEmailCap * 2, 10)
    });

    const contacts: ProviderContact[] = [];

    for (const contact of found.slice(0, 10)) {
      const email = cleanEmail(contact.email);
      if (!isValidEmail(email)) continue;

      const fullName = cleanText(contact.fullName);
      const title = cleanText(contact.designation || contact.role);

      await ProspeoRawContactModel.findOneAndUpdate(
        {
          brandName,
          domain,
          email
        },
        {
          $set: {
            brandName,
            domain,
            fullName,
            title,
            country: cleanText(contact.country),
            email,
            emailStatus: normalizeProviderStatus(contact.emailStatus || "Found", true),
            raw: contact.raw || contact
          }
        },
        { upsert: true, new: true }
      );

      contacts.push({
        email,
        fullName,
        role: title,
        source: "prospeo",
        raw: contact.raw || contact
      });
    }

    return contacts;
  } catch (error: any) {
    console.error("Prospeo discovery failed:", error?.response?.data || error.message);
    return [];
  }
}

function parseEmailsFromCell(cell: any) {
  return String(cell || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.includes("@") && !line.startsWith("("));
}

export async function discoverEmailsForBrandMap(
  brandMap: any,
  options: { mode?: "full" | "scrape_only" } = {}
) {
  const mode = options.mode === "scrape_only" ? "scrape_only" : "full";
  const brandName = cleanText(brandMap.brandName);
  const domain = normalizeDomain(brandMap.domain);

  if (!brandName || !domain || domain === "unspecified") {
    return {
      brandName,
      domain,
      status: "skipped",
      saved: 0
    };
  }

  const existing = await EmailDiscoveryModel.findOne({ brandName, domain });

  // A manual scrape is an explicit refresh; only full runs short-circuit.
  if (mode === "full" && existing?.totalEmails) {
    const shouldRefreshMissingProspeo =
      process.env.PROSPEO_REFRESH_MISSING !== "false" &&
      !hasRealEmailCell(existing.prospeo) &&
      !existing.prospeoCheckedAt;

    // Use PROSPEO_REFRESH_ALL=true temporarily after this fix to re-run
    // old records that were previously saved with verified-only Prospeo data.
    // prospeoAllCheckedAt prevents repeated refreshes once the all-status run is done.
    const shouldRefreshAllProspeo =
      process.env.PROSPEO_REFRESH_ALL === "true" && !existing.prospeoAllCheckedAt;

    if (!shouldRefreshMissingProspeo && !shouldRefreshAllProspeo) {
      return {
        brandName,
        domain,
        status: "already_processed",
        saved: 0
      };
    }
  }

  const social = await discoverWebsiteAndSocial(brandName, domain);

  const socialEmails = uniqueEmails([
    ...social.instagram.emails,
    ...social.twitter.emails,
    ...social.facebook.emails,
    ...social.linkedin.emails,
    ...social.youtube.emails,
    ...social.website.emails
  ]);

  for (const email of socialEmails) {
    await saveContact({
      brandName,
      domain,
      email,
      source: "website_social"
    });
  }

  if (mode === "scrape_only") {
    // Refresh only the scrape-owned cells; provider cells stay untouched.
    const knownEmails = uniqueEmails([
      ...socialEmails,
      ...parseEmailsFromCell(existing?.hunter),
      ...parseEmailsFromCell(existing?.apollo),
      ...parseEmailsFromCell(existing?.prospeo)
    ]);

    await EmailDiscoveryModel.findOneAndUpdate(
      { brandName, domain },
      {
        $set: {
          brandName,
          domain,

          instagram: formatSourceCell(social.instagram),
          twitter: formatSourceCell(social.twitter),
          facebook: formatSourceCell(social.facebook),
          linkedin: formatSourceCell(social.linkedin),
          youtube: formatSourceCell(social.youtube),
          website: formatSourceCell(social.website),

          totalEmails:
            knownEmails.length > 0 ? knownEmails.join("\n") : "(No emails found)",

          discoveryMode: "scrape_only",
          scrapeEmailCount: socialEmails.length,
          scrapeCheckedAt: new Date(),

          foundVia: brandMap.foundVia || existing?.foundVia || "",
          seedBrandId: brandMap.seedBrandId || null,
          brandMapId: brandMap._id,
          status: knownEmails.length > 0 ? "email_found" : "email_not_found"
        }
      },
      { upsert: true, new: true }
    );

    await BrandMapModel.findByIdAndUpdate(brandMap._id, {
      $set: {
        status: knownEmails.length > 0 ? "email_found" : "email_not_found"
      }
    });

    await PipelineTrackerModel.create({
      type: "Discovered",
      brandName,
      domain,
      status:
        "Web Scrape - " + socialEmails.length + " emails (no paid credits used)",
      timestamp: new Date()
    });

    await logDone(
      "Web Scrape",
      brandName + " - " + socialEmails.length + " emails"
    );

    return {
      brandName,
      domain,
      status: socialEmails.length > 0 ? "email_found" : "email_not_found",
      saved: socialEmails.length,
      mode: "scrape_only"
    };
  }

  // Scrape-first cascade: each paid provider only fires while the collected
  // pool is still below the threshold, so credits are spent as a fallback.
  const settings = await getAppSettings();
  const skipPaid = settings.scrapeFirstSkipPaid;
  const neededEmails = Math.max(
    settings.scrapeSkipThreshold,
    settings.maxEmailsPerBrand
  );

  const providersSkipped: string[] = [];
  let collected = [...socialEmails];

  let hunterContacts: ProviderContact[] = [];

  if (skipPaid && collected.length >= neededEmails) {
    providersSkipped.push("hunter");
  } else {
    hunterContacts = await discoverHunter(brandName, domain, settings);
    collected = uniqueEmails([
      ...collected,
      ...hunterContacts.map((contact) => contact.email)
    ]);
  }

  let apolloContacts: ProviderContact[] = [];

  if (skipPaid && collected.length >= neededEmails) {
    providersSkipped.push("apollo");
  } else {
    apolloContacts = await discoverApollo(brandName, domain, settings);
    collected = uniqueEmails([
      ...collected,
      ...apolloContacts.map((contact) => contact.email)
    ]);
  }

  let prospeoContacts: ProviderContact[] = [];

  if (skipPaid && collected.length >= neededEmails) {
    providersSkipped.push("prospeo");
  } else {
    prospeoContacts = await discoverProspeo(brandName, domain, settings);
    collected = uniqueEmails([
      ...collected,
      ...prospeoContacts.map((contact) => contact.email)
    ]);
  }

  // Combined selection: at most providerEmailCap contacts across all three
  // providers, targeted POC roles first. Only the selected ones become
  // Contacts (the raw provider collections keep everything for audit).
  const providerPool: ProviderContact[] = [
    ...hunterContacts,
    ...apolloContacts,
    ...prospeoContacts
  ];

  const selectedContacts = selectProviderContacts(
    providerPool,
    settings.providerEmailCap,
    settings
  );

  for (const contact of selectedContacts) {
    await saveContact({
      brandName,
      domain,
      email: contact.email,
      source: contact.source,
      fullName: contact.fullName,
      designation: contact.role,
      raw: contact.raw
    });
  }

  const selectedEmailSet = new Set(
    selectedContacts.map((contact) => contact.email)
  );

  const selectedEmailsFor = (contacts: ProviderContact[]) =>
    uniqueEmails(
      contacts
        .map((contact) => contact.email)
        .filter((email) => selectedEmailSet.has(email))
    );

  const hunterEmails = selectedEmailsFor(hunterContacts);
  const apolloEmails = selectedEmailsFor(apolloContacts);
  const prospeoEmails = selectedEmailsFor(prospeoContacts);

  const providerCellText = (
    provider: string,
    found: ProviderContact[],
    selected: string[]
  ) => {
    if (providersSkipped.includes(provider)) {
      return "(Skipped — scrape found " + socialEmails.length + " emails)";
    }

    if (found.length === 0) {
      return "(No " + provider + " emails found)";
    }

    if (selected.length === 0) {
      return "(" + found.length + " found, none selected by role filter)";
    }

    const header =
      selected.length < found.length
        ? "(" + selected.length + " of " + found.length + " found selected)\n"
        : "";

    return header + selected.join("\n");
  };

  const allEmails = uniqueEmails([
    ...socialEmails,
    ...hunterEmails,
    ...apolloEmails,
    ...prospeoEmails
  ]);

  await EmailDiscoveryModel.findOneAndUpdate(
    { brandName, domain },
    {
      $set: {
        brandName,
        domain,

        instagram: formatSourceCell(social.instagram),
        twitter: formatSourceCell(social.twitter),
        facebook: formatSourceCell(social.facebook),
        linkedin: formatSourceCell(social.linkedin),
        youtube: formatSourceCell(social.youtube),
        website: formatSourceCell(social.website),

        totalEmails:
          allEmails.length > 0 ? allEmails.join("\n") : "(No emails found)",

        hunter: providerCellText("hunter", hunterContacts, hunterEmails),
        apollo: providerCellText("apollo", apolloContacts, apolloEmails),
        prospeo: providerCellText("prospeo", prospeoContacts, prospeoEmails),
        prospeoCheckedAt: new Date(),
        prospeoAllCheckedAt: process.env.PROSPEO_ONLY_VERIFIED_EMAIL === "true" ? null : new Date(),

        discoveryMode: skipPaid ? "scrape_first" : "full",
        providersSkipped,
        scrapeEmailCount: socialEmails.length,
        scrapeCheckedAt: new Date(),
        hunterFoundCount: hunterContacts.length,
        apolloFoundCount: apolloContacts.length,
        prospeoFoundCount: prospeoContacts.length,
        providerSelectedCount: selectedContacts.length,

        foundVia: brandMap.foundVia || "",
        seedBrandId: brandMap.seedBrandId || null,
        brandMapId: brandMap._id,
        status: allEmails.length > 0 ? "email_found" : "email_not_found"
      }
    },
    { upsert: true, new: true }
  );

  await BrandMapModel.findByIdAndUpdate(brandMap._id, {
    $set: {
      status: allEmails.length > 0 ? "email_found" : "email_not_found"
    }
  });

  await PipelineTrackerModel.create({
    type: "Discovered",
    brandName,
    domain,
    status: allEmails.length > 0 ? "Emails Found" : "Emails Not Found",
    timestamp: new Date()
  });

  await logDone(
    "Email Discovery",
    brandName +
      " - " +
      allEmails.length +
      " emails" +
      (providersSkipped.length
        ? " (skipped: " + providersSkipped.join(", ") + ")"
        : "")
  );

  return {
    brandName,
    domain,
    status: allEmails.length > 0 ? "email_found" : "email_not_found",
    saved: allEmails.length,
    providersSkipped
  };
}

export async function discoverEmailsForPendingBrands(seedBrandName?: string) {
  const settings = await getAppSettings();

  const query: Record<string, any> = {
    domain: { $exists: true, $nin: ["", "-", null, "N/A", "unspecified"] },
    isExcluded: { $ne: true }
  };

  // Defense in depth: in manual mode only approved brands are discoverable,
  // even if this stage is somehow reached outside the selected-brands job.
  if (settings.manualSelectionMode) {
    query.selectionStatus = "approved";
  }

  if (seedBrandName) {
    query.foundVia = seedBrandName;
  }

  const limit = Number(process.env.MAX_DISCOVERY_BRANDS_PER_RUN || 100);

  const brandMaps = await BrandMapModel.find(query)
    .sort({ mostRecentSponsorshipDate: -1, updatedAt: -1 })
    .limit(limit);

  const results: any[] = [];

  for (const brandMap of brandMaps as any[]) {
    try {
      const result = await discoverEmailsForBrandMap(brandMap);
      results.push(result);
    } catch (error: any) {
      await logError(
        "Email Discovery",
        brandMap.brandName + " - " + error.message,
        error
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    scanned: brandMaps.length,
    processed: results.length,
    results
  };
}
