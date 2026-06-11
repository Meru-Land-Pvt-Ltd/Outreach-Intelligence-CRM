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

function isValidEmail(email: string) {
  if (!email) return false;

  const lower = email.toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return false;

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

async function discoverHunter(brandName: string, domain: string) {
  const key = process.env.HUNTER_API_KEY || "";
  const baseUrl = process.env.HUNTER_BASE_URL || "https://api.hunter.io/v2";

  if (!key) return [];

  try {
    const response = await axios.get(baseUrl + "/domain-search", {
      params: {
        domain,
        api_key: key,
        limit: Number(process.env.HUNTER_LIMIT || 10)
      },
      timeout: 30000,
      validateStatus: () => true
    });

    const rows = response.data?.data?.emails || [];
    const emails: string[] = [];

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

      await saveContact({
        brandName,
        domain,
        email,
        source: "hunter",
        fullName,
        designation: item.position,
        raw: item
      });

      emails.push(email);
    }

    return uniqueEmails(emails);
  } catch {
    return [];
  }
}

async function aiSelectApolloPOCs(brandName: string, people: any[]) {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key || people.length === 0) return people.slice(0, 5);

  const prompt =
    "Select the top 2 to 5 people most likely to handle influencer sponsorship, creator partnerships, affiliate marketing, PR, media, or brand collaborations.\n\n" +
    "Brand: " +
    brandName +
    "\n\nPeople:\n" +
    JSON.stringify(
      people.map((p) => ({
        id: p.id,
        name: p.name || [p.first_name, p.last_name].filter(Boolean).join(" "),
        title: p.title
      })),
      null,
      2
    ) +
    "\n\nReturn JSON only: {\"ids\":[\"apollo_id_1\"]}";

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
    return people.slice(0, 5);
  }
}

async function discoverApollo(brandName: string, domain: string) {
  const key = process.env.APOLLO_API_KEY || "";
  const baseUrl = process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1";

  if (!key) return [];

  try {
    const allPeople: any[] = [];
    const maxResults = Number(process.env.APOLLO_MAX_RESULTS || 100);
    const perPage = Number(process.env.APOLLO_PER_PAGE || 25);

    for (let page = 1; allPeople.length < maxResults; page += 1) {
      const response = await axios.post(
        baseUrl +
          (process.env.APOLLO_PEOPLE_SEARCH_ENDPOINT ||
            "/mixed_people/api_search"),
        {
          q_organization_domains: domain,
          page,
          per_page: perPage
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

      const people = response.data?.people || [];

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

    const selected = await aiSelectApolloPOCs(brandName, allPeople);
    const emails: string[] = [];

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

        await saveContact({
          brandName,
          domain,
          email,
          source: "apollo",
          fullName,
          designation: person.title,
          raw: person
        });

        emails.push(email);
      }
    }

    return uniqueEmails(emails);
  } catch {
    return [];
  }
}

async function discoverProspeo(brandName: string, domain: string) {
  if (!process.env.PROSPEO_API_KEY) return [];

  try {
    const contacts = await searchProspeoContacts(domain);
    const emails: string[] = [];

    for (const contact of contacts.slice(0, 10)) {
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

      await saveContact({
        brandName,
        domain,
        email,
        source: "prospeo",
        fullName,
        designation: title,
        raw: contact.raw || contact
      });

      emails.push(email);
    }

    return uniqueEmails(emails);
  } catch (error: any) {
    console.error("Prospeo discovery failed:", error?.response?.data || error.message);
    return [];
  }
}

export async function discoverEmailsForBrandMap(brandMap: any) {
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

  if (existing?.totalEmails) {
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

  const hunterEmails = await discoverHunter(brandName, domain);
  const apolloEmails = await discoverApollo(brandName, domain);
  const prospeoEmails = await discoverProspeo(brandName, domain);

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

        hunter:
          hunterEmails.length > 0 ? hunterEmails.join("\n") : "(No Hunter emails found)",
        apollo:
          apolloEmails.length > 0 ? apolloEmails.join("\n") : "(No Apollo emails found)",
        prospeo:
          prospeoEmails.length > 0 ? prospeoEmails.join("\n") : "(No Prospeo emails found)",
        prospeoCheckedAt: new Date(),
        prospeoAllCheckedAt: process.env.PROSPEO_ONLY_VERIFIED_EMAIL === "true" ? null : new Date(),

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
    brandName + " - " + allEmails.length + " emails"
  );

  return {
    brandName,
    domain,
    status: allEmails.length > 0 ? "email_found" : "email_not_found",
    saved: allEmails.length
  };
}

export async function discoverEmailsForPendingBrands(seedBrandName?: string) {
  const query: Record<string, any> = {
    domain: { $exists: true, $nin: ["", "-", null, "N/A", "unspecified"] },
    isExcluded: { $ne: true }
  };

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
