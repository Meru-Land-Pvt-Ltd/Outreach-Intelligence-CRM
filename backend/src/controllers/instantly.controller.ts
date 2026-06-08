import { Request, Response } from "express";
import axios from "axios";
import dns from "dns/promises";
import { Contact } from "../models/Contact.model";
import { BrandMap } from "../models/BrandMap.model";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { InstantlyTemplate } from "../models/InstantlyTemplate.model";
import { InstantlyCampaign } from "../models/InstantlyCampaign.model";
import { PushLog } from "../models/PushLog.model";
import { BounceEvent } from "../models/BounceEvent.model";

const ContactModel = Contact as any;
const BrandMapModel = BrandMap as any;
const InstantlyLeadModel = InstantlyLead as any;
const InstantlyTemplateModel = InstantlyTemplate as any;
const InstantlyCampaignModel = InstantlyCampaign as any;
const PushLogModel = PushLog as any;
const BounceEventModel = BounceEvent as any;

const ENOYLITY_RELATED_FALLBACK =
  "https://www.youtube.com/watch?v=epYZxWOC_KE&list=PL4Bx6jiikXaWgZvxXTDvM3WNwClh690-E&index=1";

const MHD_RELATED_FALLBACK =
  "https://www.youtube.com/watch?v=7oHoSLZwuFo&list=PL8qd4kKWDLTuRVZ2qejyv8sVW2OTC93or&index=1";

const DEFAULT_TEMPLATES: Record<string, any> = {
  "Enoylity Technology": {
    subject: "Feature {{companyName}} {{productName}} to 1M US Tech Buyers",
    body:
      "Hi {{firstName}},\n\n" +
      "I'm {{sendingAccountFirstName}} from Enoylity Technology. I came across {{productName}} - it's exactly what our 1M+ tech subscribers love to see reviewed.\n\n" +
      "Our last 10 brand collabs averaged 500K views each, and our audience actively buys what we feature.\n\n" +
      "Here's what you'd get:\n" +
      "- Dedicated 8-12 min full review of {{productName}}\n" +
      "- 500K+ average reach per video\n" +
      "- Your tracking link at the top of the description and pinned comment\n" +
      "- Full draft approval before publishing\n" +
      "- US shipping - we're based in Las Vegas, NV\n\n" +
      "See our brand portfolio: {{relatedVideo}}\n\n" +
      "Brands like {{competitor1}} and {{competitor2}} saw results within 48 hours of going live.\n\n" +
      "Reply to us and we'll include a 60-sec vertical clip from the review - yours to use on Amazon, TikTok, or ads. No extra cost!\n\n" +
      "Not the right contact? A forward to your partnerships team for {{companyName}} growth would mean a lot to us.\n\n" +
      "Best regards,\n" +
      "{{sendingAccountFirstName}}\n" +
      "Enoylity Technology\n" +
      "{{sendingAccountEmail}}",
    followUp1:
      "Hi {{firstName}},\n\n" +
      "Following up on the {{productName}} review. We just wrapped a brand collab last week - already past 500K views and the brand is using the 60-sec clip we gave them on their Amazon listing right now.\n\n" +
      "See our previous brand portfolio: {{relatedVideo}}\n\n" +
      "Same deal is on the table for {{companyName}}: full review + the vertical clip, yours to repurpose anywhere.\n\n" +
      "Want us to reserve your slot?\n\n" +
      "{{sendingAccountFirstName}}",
    followUp2:
      "Hello {{firstName}},\n\n" +
      "{{competitor1}} and {{competitor2}} already have dedicated YouTube reviews ranking for keywords in your category. Every day without one means {{companyName}} is invisible in those search results.\n\n" +
      "We still have the slot open - 8-12 min review, 500K+ reach, plus the 60-sec vertical clip included.\n\n" +
      "Here is our previous brand portfolio: {{relatedVideo}}\n\n" +
      "Reply and I'll lock it in for {{companyName}}.\n\n" +
      "{{sendingAccountFirstName}}\n" +
      "Enoylity Technology"
  },

  "MHD Tech": {
    subject: "Feature {{companyName}} {{productName}} to 400K Tech Buyers in One Video",
    body:
      "Hi {{firstName}},\n\n" +
      "I'm {{sendingAccountFirstName}} from MHD Tech - a YouTube channel with 580K tech subscribers who actively buy what we feature.\n\n" +
      "I came across {{companyName}}'s {{productName}} - it's a strong fit for our next round of dedicated product reviews.\n\n" +
      "Here's what you'd get:\n" +
      "- Dedicated 4-8 min full review of {{productName}}\n" +
      "- Your tracking link at the top of description and pinned comment\n" +
      "- Draft shared for your approval before publishing live\n" +
      "- Easy US shipping - we're based here in Torrance, CA\n\n" +
      "Check our previous work: {{relatedVideo}}\n\n" +
      "Our reviews rank on YouTube and Google long-term - brands use them as conversion assets, not one-time promotions.\n\n" +
      "{{competitor1}} and {{competitor2}} are already investing in YouTube reviews in your niche.\n\n" +
      "We're only onboarding a few brands this month. If you're open, reply \"interested\" for {{companyName}} {{productName}} review let us know?\n\n" +
      "Not the right contact? A quick forward to your marketing or partnerships team at {{companyName}} would be appreciated.\n\n" +
      "Best,\n" +
      "{{sendingAccountFirstName}}\n" +
      "MHD Tech Team\n" +
      "{{sendingAccountEmail}}",
    followUp1:
      "Hi {{firstName}},\n\n" +
      "Just circling back on the {{productName}} review spot. We've had a few brands confirm this week, and I wanted to make sure {{companyName}} doesn't miss the window.\n\n" +
      "Our reviews stay indexed on YouTube and Google permanently - most brands tell us they still get traffic from reviews we published 6+ months ago.\n\n" +
      "You can check our previous work: {{relatedVideo}}\n\n" +
      "If you're open, just reply \"interested\" and I'll send over the details.\n\n" +
      "{{sendingAccountFirstName}}",
    followUp2:
      "Hello {{firstName}},\n\n" +
      "Quick update - {{competitor1}} and {{competitor2}} are actively getting reviewed on YouTube in your space. Once they own the search results for your category, it's harder for {{companyName}} to break through.\n\n" +
      "We still have one slot open this month. A 4-8 min dedicated review with your tracking link, draft approval, and permanent ranking on YouTube.\n\n" +
      "Check our previous work here: {{relatedVideo}}\n\n" +
      "Reply \"interested\" if you'd like to lock it in.\n\n" +
      "{{sendingAccountFirstName}}\n" +
      "MHD Tech"
  }
};

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function listValue(value: any) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function envBool(value: any, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function instantlyBaseUrl() {
  return process.env.INSTANTLY_BASE_URL || "https://api.instantly.ai/api/v2";
}

function instantlyHeaders() {
  const key = process.env.INSTANTLY_API_KEY || "";

  if (!key || key.includes("your_")) {
    throw new Error("INSTANTLY_API_KEY missing in backend/.env");
  }

  return {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

async function instantlyApiCall(
  method: "GET" | "POST",
  endpoint: string,
  payload?: any
) {
  const response = await axios({
    method,
    url: instantlyBaseUrl().replace(/\/$/, "") + endpoint,
    data: payload,
    headers: instantlyHeaders(),
    timeout: 60000,
    validateStatus: () => true
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      "Instantly API error " + response.status + ": " + JSON.stringify(response.data)
    );
  }

  return response.data;
}

async function ensureTemplates() {
  const channels = ["Enoylity Technology", "MHD Tech"];

  for (const channel of channels) {
    const existing = await InstantlyTemplateModel.findOne({ channel });

    if (!existing) {
      await InstantlyTemplateModel.create({
        channel,
        ...DEFAULT_TEMPLATES[channel]
      });
    }
  }
}

function getAllowedSenders(channel: string) {
  if (channel === "Enoylity Technology") {
    return listValue(
      process.env.INSTANTLY_ENOYLITY_SENDERS || process.env.ENOYLITY_SENDERS
    ).map(cleanEmail);
  }

  if (channel === "MHD Tech") {
    return listValue(
      process.env.INSTANTLY_MHD_SENDERS || process.env.MHD_SENDERS
    ).map(cleanEmail);
  }

  throw new Error("Invalid channel");
}

function sanitizeSelectedSenders(channel: string, selectedSenders?: any[]) {
  const allowedSenders = getAllowedSenders(channel);
  const allowedSet = new Set(allowedSenders);

  const safeSelectedSenders = Array.isArray(selectedSenders)
    ? selectedSenders
        .map(cleanEmail)
        .filter(Boolean)
        .filter((email) => allowedSet.has(email))
    : [];

  return safeSelectedSenders.length > 0 ? safeSelectedSenders : allowedSenders;
}

function getChannelConfig(channel: string, selectedSenders?: any[]) {
  if (channel === "Enoylity Technology") {
    return {
      senders: sanitizeSelectedSenders(channel, selectedSenders),
      allSenders: getAllowedSenders(channel),
      relatedVideo: process.env.ENOYLITY_RELATED_FALLBACK || ENOYLITY_RELATED_FALLBACK,
      brandShort: "Enoylity"
    };
  }

  if (channel === "MHD Tech") {
    return {
      senders: sanitizeSelectedSenders(channel, selectedSenders),
      allSenders: getAllowedSenders(channel),
      relatedVideo: process.env.MHD_RELATED_FALLBACK || MHD_RELATED_FALLBACK,
      brandShort: "MHD"
    };
  }

  throw new Error("Invalid channel");
}

function getSenderFirstName(email: string) {
  const local = cleanEmail(email).split("@")[0] || "";
  const firstPart = local.split(/[._-]+/).filter(Boolean)[0] || "Sender";

  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
}

function replaceTemplateVariables(template: any, lead: any, senderEmail: string) {
  const senderFirstName = getSenderFirstName(senderEmail);

  return cleanText(template)
    .replace(/{{\s*firstName\s*}}/g, cleanText(lead?.firstName))
    .replace(/{{\s*companyName\s*}}/g, cleanText(lead?.companyName))
    .replace(/{{\s*productName\s*}}/g, cleanText(lead?.productName))
    .replace(/{{\s*relatedVideo\s*}}/g, cleanText(lead?.relatedVideo))
    .replace(/{{\s*competitor1\s*}}/g, cleanText(lead?.competitor1))
    .replace(/{{\s*competitor2\s*}}/g, cleanText(lead?.competitor2))
    .replace(/{{\s*sendingAccountFirstName\s*}}/g, senderFirstName)
    .replace(/{{\s*sendingAccountEmail\s*}}/g, cleanEmail(senderEmail));
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

  const genericWords = [
    "hello",
    "support",
    "sales",
    "sale",
    "marketing",
    "contact",
    "contactus",
    "info",
    "service",
    "services",
    "media",
    "affiliate",
    "kol",
    "distributor",
    "contentpartners",
    "influencer",
    "solutionservice",
    "solutionsales",
    "press",
    "pr",
    "team",
    "admin",
    "care",
    "help",
    "partners",
    "partner",
    "partnership",
    "partnerships",
    "business",
    "order",
    "receive",
    "feedback",
    "customer",
    "cs",
    "frsupport",
    "desupport",
    "uk",
    "de",
    "eu",
    "jp",
    "kr",
    "us",
    "au",
    "ca"
  ];

  return genericWords.some((word) => {
    return (
      local === word ||
      local.startsWith(word + ".") ||
      local.startsWith(word + "-") ||
      local.startsWith(word + "_")
    );
  });
}

function inferFullNameFromEmail(email: string, brandName: string) {
  const local = String(email || "").split("@")[0].toLowerCase();

  if (!local) return "";

  if (isGenericEmail(email)) {
    return brandName ? brandName + " Team" : "";
  }

  const parts = local
    .replace(/\d+/g, "")
    .split(/[._-]/)
    .filter(Boolean)
    .filter((part) => part.length > 1);

  if (parts.length === 0) return "";

  return titleCase(parts.join(" "));
}

function inferRoleFromEmail(email: string) {
  const local = String(email || "").split("@")[0].toLowerCase();

  if (local.includes("influencer") || local.includes("kol")) {
    return "Influencer Marketing";
  }

  if (local.includes("affiliate")) {
    return "Affiliate Marketing";
  }

  if (
    local.includes("contentpartner") ||
    local.includes("partner") ||
    local.includes("partnership")
  ) {
    return "Partnerships";
  }

  if (local.includes("media") || local.includes("press") || local === "pr") {
    return "Media / PR";
  }

  if (local.includes("marketing")) {
    return "Marketing";
  }

  if (local.includes("sales") || local === "sale") {
    return "Sales";
  }

  if (
    local.includes("support") ||
    local.includes("service") ||
    local === "cs" ||
    local.includes("customer")
  ) {
    return "Support";
  }

  if (local.includes("business")) {
    return "Business";
  }

  return "";
}

function getBetterFirstName(contact: any, brandName: string) {
  const email = cleanEmail(contact.email);

  if (isGenericEmail(email)) {
    return brandName + " Team";
  }

  if (
    contact.firstName &&
    cleanText(contact.firstName).toLowerCase() !== "unknown"
  ) {
    return cleanText(contact.firstName).split(/\s+/)[0];
  }

  if (
    contact.fullName &&
    cleanText(contact.fullName).toLowerCase() !== "unknown"
  ) {
    return cleanText(contact.fullName).split(/\s+/)[0];
  }

  const inferredName = inferFullNameFromEmail(email, brandName);

  if (!inferredName) {
    return brandName + " Team";
  }

  return inferredName.split(/\s+/)[0];
}

async function normalizeContactBeforeExport(contact: any, brandName: string) {
  const email = cleanEmail(contact.email);

  if (!email) return contact;

  const currentName = cleanText(contact.fullName);
  const currentRole = cleanText(contact.designation || contact.role);

  const inferredName = currentName || inferFullNameFromEmail(email, brandName);
  const inferredRole = currentRole || inferRoleFromEmail(email);

  const update: Record<string, any> = {};

  if (!currentName && inferredName) {
    update.fullName = inferredName;
    update.firstName = inferredName.split(/\s+/)[0];
  }

  if (!currentRole && inferredRole) {
    update.designation = inferredRole;
    update.role = inferredRole;
  }

  if (Object.keys(update).length > 0) {
    await ContactModel.findByIdAndUpdate(contact._id, {
      $set: update
    });

    const plain = contact.toObject ? contact.toObject() : contact;

    return {
      ...plain,
      ...update
    };
  }

  return contact;
}

function getProductNameFromBrandMap(brandMap: any) {
  const products = Array.isArray(brandMap.productNames)
    ? brandMap.productNames
    : [];

  let product = cleanText(products[0] || "");

  if (!product && Array.isArray(brandMap.channelNames)) {
    for (const line of brandMap.channelNames) {
      const match = String(line || "").match(/\(([^)]+)\)/);

      if (match?.[1]) {
        product = match[1].split(",")[0].trim();
        break;
      }
    }
  }

  const brandName = cleanText(brandMap.brandName);

  if (
    product &&
    brandName &&
    product.toLowerCase().startsWith(brandName.toLowerCase())
  ) {
    product = product.substring(brandName.length).trim();
  }

  return product;
}

function getDomainFromEmail(email: string) {
  return String(email || "").split("@")[1]?.trim().toLowerCase() || "";
}

async function checkEmailGateway(domain: string) {
  if (!domain) return "No Domain";

  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0 ? "Safe" : "No MX";
  } catch {
    return "No MX";
  }
}

async function verifyEmailWithMillionVerifier(email: string) {
  const key = process.env.MILLION_VERIFIER_API_KEY || "";

  if (!key) {
    throw new Error("MILLION_VERIFIER_API_KEY missing in backend/.env");
  }

  const response = await axios.get(
    process.env.MILLION_VERIFIER_BASE_URL || "https://api.millionverifier.com/api/v3",
    {
      params: {
        api: key,
        email,
        timeout: process.env.MILLION_VERIFIER_TIMEOUT || 20
      },
      timeout: 30000
    }
  );

  const data = response.data || {};
  const result = String(data.result || data.status || data.quality || "").toLowerCase();

  if (["ok", "valid", "good", "deliverable"].includes(result)) {
    return { status: "Ok", raw: data };
  }

  if (["invalid", "bad", "undeliverable"].includes(result)) {
    return { status: "Invalid", raw: data };
  }

  if (result.includes("catch")) {
    return { status: "Catch-all", raw: data };
  }

  if (result.includes("disposable")) {
    return { status: "Disposable", raw: data };
  }

  return { status: "Unknown", raw: data };
}

function escapeHtmlForInstantly(value: any) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeLeadStatus(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function isVerificationRejected(value: any) {
  const status = normalizeLeadStatus(value);

  if (!status || status === "-") return false;

  return [
    "invalid",
    "bad",
    "failed",
    "fail",
    "rejected",
    "undeliverable",
    "do-not-mail",
    "do-not-send",
    "spamtrap",
    "abuse",
    "disposable"
  ].includes(status);
}

function isBounceRejected(value: any) {
  const status = normalizeLeadStatus(value);

  if (!status || status === "-" || status === "safe") return false;

  return [
    "yes",
    "true",
    "1",
    "bounced",
    "bounce",
    "hard-bounce",
    "gateway-bounced",
    "instantly-bounced",
    "failed",
    "blocked",
    "invalid"
  ].includes(status);
}

function isAlreadyPushed(value: any) {
  const status = String(value || "").trim().toLowerCase();

  if (!status || status === "-") return false;

  return status.includes("pushed") ||
    status === "sent" ||
    status === "success" ||
    status === "done" ||
    status === "yes" ||
    status === "true";
}

function isEligibleForInstantlyPush(lead: any) {
  const email = cleanEmail(lead?.email);

  if (!email || !email.includes("@")) return false;
  if (isAlreadyPushed(lead?.pushedStatus)) return false;
  if (isVerificationRejected(lead?.verificationStatus)) return false;
  if (isBounceRejected(lead?.instantlyBounced)) return false;
  if (isBounceRejected(lead?.gatewayBounced)) return false;

  return true;
}


function toInstantlyHtml(value: any) {
  const normalized = String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (!normalized) return "";

  return normalized
    .split("\n")
    .map((line) => {
      const text = line.trim();

      if (!text) {
        return "<div><br></div>";
      }

      return `<div>${escapeHtmlForInstantly(line)}</div>`;
    })
    .join("");
}

function getInstantlyTimezone() {
  return (
    process.env.INSTANTLY_DEFAULT_TIMEZONE ||
    process.env.DEFAULT_TIMEZONE ||
    "Asia/Kolkata"
  );
}

function getTodayDateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function getCampaignLaunchStatus(startDate: string) {
  const date = cleanText(startDate);
  const today = getTodayDateInTimezone(getInstantlyTimezone());

  if (!date) return "launched";

  return date <= today ? "launched" : "scheduled";
}


function buildCampaignPayload(input: {
  channel: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dailyLimit: number;
  template: any;
  selectedSenders?: any[];
}) {
  const cfg = getChannelConfig(input.channel, input.selectedSenders);
  const timezone = getInstantlyTimezone();

  return {
    name: input.campaignName,
    campaign_schedule: {
      start_date: input.startDate,
      end_date: input.endDate,
      schedules: [
        {
          name: "Default Schedule",
          timing: {
            from: input.startTime,
            to: input.endTime
          },
          days: {
            "0": false,
            "1": true,
            "2": true,
            "3": true,
            "4": true,
            "5": true,
            "6": false
          },
          timezone
        }
      ]
    },
    sequences: [
      {
        steps: [
          {
            type: "email",
            delay: 0,
            delay_unit: "days",
            variants: [
              {
                subject: input.template.subject,
                body: toInstantlyHtml(input.template.body)
              }
            ]
          },
          {
            type: "email",
            delay: Number(process.env.DEFAULT_FOLLOWUP_1_DAYS || 2),
            delay_unit: "days",
            variants: [
              {
                subject: "",
                body: toInstantlyHtml(input.template.followUp1)
              }
            ]
          },
          {
            type: "email",
            delay: Number(process.env.DEFAULT_FOLLOWUP_2_DAYS || 5),
            delay_unit: "days",
            variants: [
              {
                subject: "",
                body: toInstantlyHtml(input.template.followUp2)
              }
            ]
          }
        ]
      }
    ],
    email_list: cfg.senders,
    daily_limit: input.dailyLimit,
    email_gap: Number(process.env.INSTANTLY_EMAIL_GAP || process.env.EMAIL_GAP_MINUTES || 5),
    random_wait_max: Number(
      process.env.INSTANTLY_RANDOM_WAIT_MAX ||
        process.env.RANDOM_WAIT_MAX_MINUTES ||
        3
    ),
    stop_on_reply: true,
    open_tracking: true,
    link_tracking: false,
    text_only: false
  };
}

async function getEligibleLeads(input: {
  channel: string;
  numLeads: number;
  usedEmails?: Record<string, boolean>;
}) {
  const rows = await InstantlyLeadModel.find({
    channel: input.channel,
    email: { $exists: true, $nin: ["", null] },
    pushedStatus: { $in: ["", null] },
    instantlyBounced: { $in: ["", null] }
  }).sort({ createdAt: 1 });

  const leadsToPush: any[] = [];
  const leadIds: any[] = [];
  const checkedGateways: Record<string, string> = {};

  for (const row of rows as any[]) {
    if (leadsToPush.length >= input.numLeads) break;

    const email = cleanEmail(row.email);

    if (!email) continue;
    if (input.usedEmails && input.usedEmails[email]) continue;

    let verificationStatus = cleanText(row.verificationStatus);

    if (!verificationStatus) {
      const verifyResult = await verifyEmailWithMillionVerifier(email);
      verificationStatus = verifyResult.status;

      await InstantlyLeadModel.findByIdAndUpdate(row._id, {
        $set: {
          verificationStatus,
          raw: {
            ...(row.raw || {}),
            millionVerifier: verifyResult.raw
          }
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (isVerificationRejected(verificationStatus)) {
      continue;
    }

    let gatewayStatus = cleanText(row.gatewayBounced);

    if (!gatewayStatus) {
      const domain = getDomainFromEmail(email);

      if (domain && checkedGateways[domain]) {
        gatewayStatus = checkedGateways[domain];
      } else {
        gatewayStatus = await checkEmailGateway(domain);
        if (domain) checkedGateways[domain] = gatewayStatus;
      }

      await InstantlyLeadModel.findByIdAndUpdate(row._id, {
        $set: {
          gatewayBounced: gatewayStatus
        }
      });
    }

    if (isBounceRejected(gatewayStatus)) {
      continue;
    }

    if (!isEligibleForInstantlyPush(row)) {
      continue;
    }

    leadsToPush.push(row);
    leadIds.push(row._id);

    if (input.usedEmails) {
      input.usedEmails[email] = true;
    }
  }

  return { leadsToPush, leadIds };
}

async function createAndPushCampaign(input: {
  channel: string;
  campaignName: string;
  numLeads: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dailyLimit: number;
  selectedSenders?: any[];
  usedEmails?: Record<string, boolean>;
}) {
  await ensureTemplates();

  const template = await InstantlyTemplateModel.findOne({
    channel: input.channel
  });

  if (!template) {
    throw new Error("Template not found for " + input.channel);
  }

  const searchResult = await instantlyApiCall(
    "GET",
    "/campaigns?search=" + encodeURIComponent(input.campaignName) + "&limit=100"
  );

  const campaigns = Array.isArray(searchResult?.items)
    ? searchResult.items
    : Array.isArray(searchResult)
      ? searchResult
      : [];

  for (const campaign of campaigns) {
    if (campaign.name === input.campaignName) {
      throw new Error('Campaign "' + input.campaignName + '" already exists. Change the name.');
    }
  }

  const { leadsToPush, leadIds } = await getEligibleLeads({
    channel: input.channel,
    numLeads: input.numLeads,
    usedEmails: input.usedEmails
  });

  if (leadsToPush.length === 0) {
    throw new Error("No valid eligible leads found after verification and gateway check.");
  }

  const competitorFillBeforePush = await fillCompetitorsForCompanies(
    leadsToPush.map((lead) => lead.companyName)
  );

  if (competitorFillBeforePush.updated > 0) {
    const refreshedLeads = await InstantlyLeadModel.find({
      _id: { $in: leadIds }
    }).lean();

    const refreshedById = new Map(
      refreshedLeads.map((lead: any) => [String(lead._id), lead])
    );

    for (let index = 0; index < leadsToPush.length; index += 1) {
      const refreshedLead = refreshedById.get(String(leadIds[index]));

      if (refreshedLead) {
        leadsToPush[index] = refreshedLead;
      }
    }
  }

  const payload = buildCampaignPayload({
    ...input,
    template
  });

  const campaignSenders = Array.isArray(payload.email_list)
    ? payload.email_list
    : [];

  const createResp = await instantlyApiCall("POST", "/campaigns", payload);
  const campaignId = String(createResp.id || "");

  if (!campaignId) {
    throw new Error("Instantly campaign was not created: " + JSON.stringify(createResp));
  }

  let totalPushed = 0;
  const pushedAt = new Date();
  const pushedLabel =
    "Pushed " +
    pushedAt.toISOString().substring(0, 16).replace("T", " ") +
    " - " +
    input.campaignName;

  for (let i = 0; i < leadsToPush.length; i++) {
    const lead = leadsToPush[i];

    await instantlyApiCall("POST", "/leads", {
      campaign: campaignId,
      email: lead.email,
      first_name: lead.firstName,
      company_name: lead.companyName,
      custom_variables: {
        productName: lead.productName || "",
        relatedVideo: lead.relatedVideo || "",
        competitor1: lead.competitor1 || "",
        competitor2: lead.competitor2 || ""
      }
    });

    await InstantlyLeadModel.findByIdAndUpdate(leadIds[i], {
      $set: {
        pushedStatus: pushedLabel,
        campaignId
      }
    });

    await ContactModel.updateMany(
      { email: lead.email },
      {
        $set: {
          status: "pushed",
          instantlyCampaignId: campaignId
        }
      }
    );

    totalPushed += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const campaignLaunchStatus = getCampaignLaunchStatus(input.startDate);

  let activatedAt: Date | undefined;

  await instantlyApiCall("POST", "/campaigns/" + campaignId + "/activate", {});
  activatedAt = new Date();

  await InstantlyCampaignModel.create({
    channel: input.channel,
    campaignName: input.campaignName,
    instantlyCampaignId: campaignId,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
    dailyLimit: input.dailyLimit,
    leadsPushed: totalPushed,
    validLeadsFound: leadsToPush.length,
    selectedSenders: campaignSenders,
    status: activatedAt ? campaignLaunchStatus : "created",
    pushedAt,
    activatedAt,
    raw: {
      createResp,
      payload
    }
  });

  await PushLogModel.create({
    channel: input.channel,
    campaignName: input.campaignName,
    campaignId,
    totalPushed,
    dailyLimit: input.dailyLimit,
    status: "Success",
    message: totalPushed + ' leads pushed to "' + input.campaignName + '"',
    raw: {
      leads: leadsToPush.map((lead) => lead.email),
      selectedSenders: campaignSenders
    }
  });

  return {
    campaignId,
    totalPushed
  };
}

async function askOpenAIForCompetitors(companyName: string) {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key) {
    return {
      competitor1: "",
      competitor2: ""
    };
  }

  const prompt =
    "Find 2 direct competitor brands for this company.\n\n" +
    "Company: " +
    companyName +
    "\n\n" +
    "Rules:\n" +
    "1. Return direct competitors only.\n" +
    "2. Return brand names only.\n" +
    "3. No explanations.\n" +
    "4. Output exactly JSON like this:\n" +
    '{"competitor1":"Brand A","competitor2":"Brand B"}';

  try {
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a market research assistant. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    let text = String(response.data?.choices?.[0]?.message?.content || "").trim();

    text = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : JSON.parse(text);

    return {
      competitor1: cleanText(json.competitor1),
      competitor2: cleanText(json.competitor2)
    };
  } catch (error: any) {
    console.error(
      "Competitor OpenAI failed for",
      companyName,
      error?.response?.data || error.message
    );

    return {
      competitor1: "",
      competitor2: ""
    };
  }
}

async function fillCompetitorsForCompanies(companyNames: string[]) {
  const uniqueCompanies = Array.from(
    new Set(
      companyNames
        .map((name) => cleanText(name))
        .filter(Boolean)
    )
  );

  let updated = 0;
  const results: any[] = [];

  for (const companyName of uniqueCompanies) {
    const needsUpdate = await InstantlyLeadModel.countDocuments({
      companyName,
      $or: [
        { competitor1: { $exists: false } },
        { competitor1: "" },
        { competitor1: null },
        { competitor1: "-" },
        { competitor2: { $exists: false } },
        { competitor2: "" },
        { competitor2: null },
        { competitor2: "-" }
      ]
    });

    if (!needsUpdate) {
      continue;
    }

    const competitors = await askOpenAIForCompetitors(companyName);

    if (!cleanText(competitors.competitor1) && !cleanText(competitors.competitor2)) {
      results.push({
        companyName,
        competitor1: "",
        competitor2: "",
        updated: 0,
        skipped: true
      });

      continue;
    }

    const result = await InstantlyLeadModel.updateMany(
      {
        companyName,
        $or: [
          { competitor1: { $exists: false } },
          { competitor1: "" },
          { competitor1: null },
          { competitor1: "-" },
          { competitor2: { $exists: false } },
          { competitor2: "" },
          { competitor2: null },
          { competitor2: "-" }
        ]
      },
      {
        $set: {
          competitor1: cleanText(competitors.competitor1),
          competitor2: cleanText(competitors.competitor2)
        }
      }
    );

    updated += result.modifiedCount || 0;

    results.push({
      companyName,
      competitor1: competitors.competitor1,
      competitor2: competitors.competitor2,
      updated: result.modifiedCount || 0
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    companies: uniqueCompanies.length,
    updated,
    data: results
  };
}


function weekdayDates(startDate: string, numWeekdays: number) {
  const dates: Date[] = [];
  const cursor = new Date(startDate + "T00:00:00");

  while (dates.length < numWeekdays) {
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function formatCampaignDate(date: Date) {
  return date.toISOString().substring(0, 10);
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short"
  });
}

export async function getInstantlyLeads(req: Request, res: Response) {
  try {
    const filter: Record<string, any> = {};

    if (req.query.channel) {
      filter.channel = String(req.query.channel);
    }

    let rows = await InstantlyLeadModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(2000);

    const missingCompetitorCompanies: string[] = Array.from(
      new Set<string>(
        (rows as any[])
          .filter(
            (row: any) =>
              !cleanText(row.competitor1) || !cleanText(row.competitor2)
          )
          .map((row: any) => cleanText(row.companyName))
          .filter((companyName: string) => companyName.length > 0)
      )
    );

    if (missingCompetitorCompanies.length > 0) {
      await fillCompetitorsForCompanies(missingCompetitorCompanies);

      rows = await InstantlyLeadModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(2000);
    }

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function exportInstantlyLeads(req: Request, res: Response) {
  try {
    const brandNameFilter = cleanText(req.body?.brandName);

    const brandMaps = await BrandMapModel.find(
      brandNameFilter ? { brandName: brandNameFilter } : {}
    ).sort({ createdAt: -1 });

    let exported = 0;
    let skippedAlreadyExported = 0;
    let contactsNormalized = 0;
    const companiesForCompetitors = new Set<string>();

    const alreadyExportedEmails: Record<string, boolean> = {};

    const existingLeads = await InstantlyLeadModel.find({
      email: { $exists: true, $nin: ["", null] }
    });

    for (const lead of existingLeads as any[]) {
      const email = cleanEmail(lead.email);

      if (email) {
        alreadyExportedEmails[email] = true;
      }
    }

    for (const brandMap of brandMaps as any[]) {
      const brandName = cleanText(brandMap.brandName);
      const domain = cleanText(brandMap.domain);

      if (!brandName || !domain) continue;

      const contacts = await ContactModel.find({
        brandName,
        domain,
        email: { $exists: true, $nin: ["", null] },
        status: { $nin: ["invalid", "bounced", "skipped"] },
        verificationStatus: { $nin: ["invalid", "bounced"] }
      }).sort({ createdAt: 1 });

      const productName = getProductNameFromBrandMap(brandMap);

      for (const originalContact of contacts as any[]) {
        const email = cleanEmail(originalContact.email);

        if (!email) continue;

        if (alreadyExportedEmails[email]) {
          skippedAlreadyExported += 1;
          continue;
        }

        const contact = await normalizeContactBeforeExport(
          originalContact,
          brandName
        );

        if (
          !cleanText(originalContact.fullName) ||
          !cleanText(originalContact.designation || originalContact.role)
        ) {
          contactsNormalized += 1;
        }

        const firstName = getBetterFirstName(contact, brandName);

        for (const channel of ["Enoylity Technology", "MHD Tech"] as const) {
          const cfg = getChannelConfig(channel);

          await InstantlyLeadModel.create({
            channel,
            firstName,
            email,
            companyName: brandName,
            productName,
            relatedVideo: cfg.relatedVideo,

            competitor1: "",
            competitor2: "",

            pushedStatus: "",
            verificationStatus:
              contact.status === "verified" ||
              contact.verificationStatus === "valid" ||
              contact.verificationStatus === "Ok"
                ? "Ok"
                : "",

            instantlyBounced: "",
            gatewayBounced: "",

            brandMapId: brandMap._id,
            contactId: contact._id,

            raw: {
              source: "exportInstantlyLeads",
              oldGasEquivalent: "exportToInstantly"
            }
          });

          exported += 1;
          companiesForCompetitors.add(brandName);
        }

        alreadyExportedEmails[email] = true;
      }
    }

    const competitorFill = await fillCompetitorsForCompanies(Array.from(companiesForCompetitors));

    res.json({
      success: true,
      exported,
      competitorsCompanies: competitorFill.companies,
      competitorsUpdated: competitorFill.updated,
      skippedAlreadyExported,
      contactsNormalized
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getTemplates(req: Request, res: Response) {
  try {
    await ensureTemplates();

    const rows = await InstantlyTemplateModel.find({}).sort({ channel: 1 });

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function saveTemplate(req: Request, res: Response) {
  try {
    const { channel, subject, body, followUp1, followUp2 } = req.body;

    if (!channel) {
      return res.status(400).json({
        success: false,
        message: "Channel is required"
      });
    }

    const row = await InstantlyTemplateModel.findOneAndUpdate(
      { channel },
      {
        $set: {
          subject,
          body,
          followUp1,
          followUp2
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    res.json({
      success: true,
      data: row
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getSenders(req: Request, res: Response) {
  try {
    const channel = cleanText(req.query.channel || "Enoylity Technology");
    const cfg = getChannelConfig(channel);

    res.json({
      success: true,
      count: cfg.allSenders.length,
      data: cfg.allSenders,
      senders: cfg.allSenders
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load sender emails"
    });
  }
}

export async function getImportedLeads(req: Request, res: Response) {
  try {
    const channel = cleanText(req.query.channel || "Enoylity Technology");
    const limit = Math.min(Number(req.query.limit || 5), 200);

    const rows = await InstantlyLeadModel.find({ channel })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
      leads: rows
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load imported leads"
    });
  }
}

export async function getTemplatePreview(req: Request, res: Response) {
  try {
    await ensureTemplates();

    const channel = cleanText(req.query.channel || "Enoylity Technology");
    const leadId = cleanText(req.query.leadId);
    const email = cleanEmail(req.query.email);

    const cfg = getChannelConfig(channel);
    const senderEmail = cfg.senders[0] || cfg.allSenders?.[0] || "";

    const template = await InstantlyTemplateModel.findOne({ channel });

    const requestedLeadQuery: any = { channel };

    if (leadId && /^[a-f0-9]{24}$/i.test(leadId)) {
      requestedLeadQuery._id = leadId;
    } else if (email) {
      requestedLeadQuery.email = email;
    }

    let lead = null;

    if (requestedLeadQuery._id || requestedLeadQuery.email) {
      lead = await InstantlyLeadModel.findOne(requestedLeadQuery);
    }

    if (!lead && email) {
      lead = await InstantlyLeadModel.findOne({
        channel,
        email
      });
    }

    if (!lead && !leadId && !email) {
      lead = await InstantlyLeadModel.findOne({
        channel,
        email: { $exists: true, $nin: ["", null] },
        pushedStatus: { $in: ["", null] },
        instantlyBounced: { $in: ["", null] }
      }).sort({ createdAt: -1 });
    }

    if (!template || !lead) {
      return res.json({
        success: true,
        data: null,
        preview: null,
        message: leadId || email ? "Selected lead preview not found." : "No lead/template found."
      });
    }

    const preview = {
      lead,
      subject: replaceTemplateVariables(template.subject, lead, senderEmail),
      body: toInstantlyHtml(replaceTemplateVariables(template.body, lead, senderEmail)),
      followUp1: toInstantlyHtml(replaceTemplateVariables(template.followUp1, lead, senderEmail)),
      followUp2: toInstantlyHtml(replaceTemplateVariables(template.followUp2, lead, senderEmail))
    };

    return res.json({
      success: true,
      data: preview,
      preview
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load template preview"
    });
  }
}

export async function fillCompetitors(req: Request, res: Response) {
  try {
    const companyFilter = cleanText(req.body?.companyName);

    const filter: Record<string, any> = {
      companyName: { $exists: true, $nin: ["", null] },
      $or: [
        { competitor1: { $exists: false } },
        { competitor1: "" },
        { competitor1: null },
        { competitor1: "-" }
      ]
    };

    if (companyFilter) {
      filter.companyName = companyFilter;
    }

    const rows: any[] = await InstantlyLeadModel.find(filter).sort({
      companyName: 1
    });

    const companies: string[] = Array.from(
      new Set(
        rows
          .map((row: any) => cleanText(row.companyName))
          .filter((companyName: string) => companyName.length > 0)
      )
    );

    let updated = 0;
    const results: any[] = [];

    for (const companyName of companies) {
      const competitors = await askOpenAIForCompetitors(companyName);

      const result = await InstantlyLeadModel.updateMany(
        {
          companyName,
          $or: [
            { competitor1: { $exists: false } },
            { competitor1: "" },
            { competitor1: null },
            { competitor1: "-" }
          ]
        },
        {
          $set: {
            competitor1: competitors.competitor1,
            competitor2: competitors.competitor2
          }
        }
      );

      updated += result.modifiedCount || 0;

      results.push({
        companyName,
        competitor1: competitors.competitor1,
        competitor2: competitors.competitor2,
        updated: result.modifiedCount || 0
      });
    }

    res.json({
      success: true,
      companies: companies.length,
      updated,
      data: results
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function pushToInstantly(req: Request, res: Response) {
  try {
    const channel = req.body.channel;
    const campaignName = req.body.campaignName;
    const numLeads = Number(req.body.numLeads || 0);
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const startTime =
      req.body.startTime || process.env.INSTANTLY_DEFAULT_START_TIME || "09:00";
    const endTime =
      req.body.endTime || process.env.INSTANTLY_DEFAULT_END_TIME || "16:00";
    const dailyLimit = Number(
      req.body.dailyLimit || process.env.INSTANTLY_DEFAULT_DAILY_LIMIT || 160
    );
    const selectedSenders = Array.isArray(req.body.selectedSenders)
      ? req.body.selectedSenders
      : [];

    if (
      !channel ||
      !campaignName ||
      !numLeads ||
      !startDate ||
      !endDate ||
      !startTime ||
      !endTime ||
      !dailyLimit
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const result = await createAndPushCampaign({
      channel,
      campaignName,
      numLeads,
      startDate,
      endDate,
      startTime,
      endTime,
      dailyLimit,
      selectedSenders
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    await PushLogModel.create({
      channel: req.body?.channel,
      campaignName: req.body?.campaignName,
      totalPushed: 0,
      dailyLimit: req.body?.dailyLimit,
      status: "Failed",
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function batchPushCampaigns(req: Request, res: Response) {
  try {
    const channel = req.body.channel;
    const numLeads = Number(req.body.numLeads || 0);
    const startDate = req.body.startDate;
    const startTime = req.body.startTime || "09:00";
    const endTime = req.body.endTime || "16:00";
    const dailyLimit = Number(req.body.dailyLimit || 160);
    const numWeekdays = Number(req.body.numWeekdays || 0);

    if (
      !channel ||
      !numLeads ||
      !startDate ||
      !startTime ||
      !endTime ||
      !dailyLimit ||
      !numWeekdays
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Channel, leads, start date, time range, daily limit, and weekdays are required"
      });
    }

    const selectedSenders = Array.isArray(req.body.selectedSenders)
      ? req.body.selectedSenders
      : [];

    const cfg = getChannelConfig(channel, selectedSenders);
    const dates = weekdayDates(startDate, numWeekdays);
    const usedEmails: Record<string, boolean> = {};

    let createdCampaigns = 0;
    let totalPushed = 0;
    const results: any[] = [];

    for (const date of dates) {
      const dateStr = formatCampaignDate(date);
      const dayLabel = formatDayLabel(date);
      const campaignName = dayLabel + " (" + cfg.brandShort + ")";

      const result = await createAndPushCampaign({
        channel,
        campaignName,
        numLeads,
        startDate: dateStr,
        endDate: dateStr,
        startTime,
        endTime,
        dailyLimit,
        selectedSenders,
        usedEmails
      });

      createdCampaigns += 1;
      totalPushed += result.totalPushed;

      results.push({
        campaignName,
        ...result
      });
    }

    res.json({
      success: true,
      createdCampaigns,
      totalPushed,
      data: results
    });
  } catch (error: any) {
    await PushLogModel.create({
      channel: req.body?.channel,
      campaignName: "Batch Push",
      totalPushed: 0,
      dailyLimit: req.body?.dailyLimit,
      status: "Failed",
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getInstantlyCampaigns(req: Request, res: Response) {
  try {
    const rows = await InstantlyCampaignModel.find({})
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPushLogs(req: Request, res: Response) {
  try {
    const rows = await PushLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getBounceEvents(req: Request, res: Response) {
  try {
    const rows = await BounceEventModel.find({})
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getCampaignIdsForBounceMode(mode: string): Promise<string[]> {
  if (mode === "all") {
    const ids: string[] = [];
    let startingAfter = "";

    while (true) {
      let endpoint = "/campaigns?limit=100";

      if (startingAfter) {
        endpoint += "&starting_after=" + encodeURIComponent(String(startingAfter));
      }

      const result: any = await instantlyApiCall("GET", endpoint);
      const items: any[] = Array.isArray(result?.items) ? result.items : [];

      for (const item of items) {
        if (item?.id) {
          ids.push(String(item.id));
        }
      }

      if (!result?.next_starting_after) break;

      startingAfter = String(result.next_starting_after);
    }

    return ids;
  }

  const localCampaigns: any[] = await InstantlyCampaignModel.find({
    instantlyCampaignId: { $exists: true, $nin: ["", null] }
  }).lean();

  return localCampaigns
    .map((campaign: any) => String(campaign.instantlyCampaignId || ""))
    .filter(Boolean);
}

export async function pullBouncedFromInstantly(req: Request, res: Response) {
  try {
    const mode = req.body?.mode === "all" ? "all" : "crm";
    const campaignIds = await getCampaignIdsForBounceMode(mode);

    if (campaignIds.length === 0) {
      return res.json({
        success: true,
        mode,
        campaignsScanned: 0,
        uniqueBouncedEmails: 0,
        totalUpdated: 0,
        message: "No campaigns found for selected mode"
      });
    }

    const bouncedEmails: Record<string, boolean> = {};

    for (const campaignIdRaw of campaignIds) {
      const campaignId = String(campaignIdRaw);
      let cursor = "";

      while (true) {
        const payload: Record<string, any> = {
          campaign: campaignId,
          filter: "FILTER_VAL_BOUNCED",
          limit: 100
        };

        if (cursor) {
          payload.starting_after = cursor;
        }

        const result: any = await instantlyApiCall("POST", "/leads/list", payload);
        const items: any[] = Array.isArray(result?.items) ? result.items : [];

        for (const item of items) {
          const email = cleanEmail(item.email);

          if (!email) continue;

          bouncedEmails[email] = true;

          await BounceEventModel.create({
            email,
            campaignId,
            eventType: "bounced",
            reason: item.status || "FILTER_VAL_BOUNCED",
            source: mode,
            raw: item
          });
        }

        if (!result?.next_starting_after) break;

        cursor = String(result.next_starting_after);
      }
    }

    const emails = Object.keys(bouncedEmails);
    let totalUpdated = 0;

    for (const email of emails) {
      const leadResult = await InstantlyLeadModel.updateMany(
        { email },
        {
          $set: {
            instantlyBounced: "Bounced"
          }
        }
      );

      await ContactModel.updateMany(
        { email },
        {
          $set: {
            status: "bounced",
            verificationStatus: "bounced",
            bouncedAt: new Date()
          }
        }
      );

      totalUpdated += leadResult.modifiedCount || 0;
    }

    res.json({
      success: true,
      mode,
      campaignsScanned: campaignIds.length,
      uniqueBouncedEmails: emails.length,
      totalUpdated
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function instantlyWebhook(req: Request, res: Response) {
  try {
    const payload = req.body || {};
    const eventType = String(
      payload.event_type || payload.type || payload.event || ""
    ).toLowerCase();

    const email = cleanEmail(
      payload.email || payload?.lead?.email || payload?.data?.email
    );

    const campaignId = String(
      payload.campaign_id ||
        payload.campaignId ||
        payload?.campaign?.id ||
        ""
    );

    if (eventType.includes("bounce") && email) {
      await BounceEventModel.create({
        email,
        campaignId,
        eventType,
        reason: payload.reason || "",
        source: "webhook",
        raw: payload
      });

      await InstantlyLeadModel.updateMany(
        { email },
        {
          $set: {
            instantlyBounced: "Bounced"
          }
        }
      );

      await ContactModel.updateMany(
        { email },
        {
          $set: {
            status: "bounced",
            verificationStatus: "bounced",
            bouncedAt: new Date()
          }
        }
      );
    }

    res.json({
      success: true,
      received: true
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
