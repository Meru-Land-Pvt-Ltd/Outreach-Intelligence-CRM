import { Request, Response } from "express";
import mongoose from "mongoose";
import axios from "axios";
import dns from "dns/promises";
import { Contact } from "../models/Contact.model";
import { BrandMap } from "../models/BrandMap.model";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { InstantlyTemplate } from "../models/InstantlyTemplate.model";
import { InstantlyCampaign } from "../models/InstantlyCampaign.model";
import { PushLog } from "../models/PushLog.model";
import { BounceEvent } from "../models/BounceEvent.model";
import { safeEqual } from "./auth.controller";
import { getAppSettings } from "./settings.controller";
import { generateAiText } from "../utils/aiText";

const ROLE_TIER_PATTERNS: Array<{ tier: number; pattern: RegExp }> = [
  {
    tier: 1,
    pattern: /founder|co-?founder|ceo|chief executive|owner|president/i
  },
  {
    tier: 2,
    pattern:
      /cmo|marketing|partnership|collab|influencer|brand|public relations|\bpr\b|growth|social media/i
  },
  {
    tier: 3,
    pattern: /sales|business development|\bbd\b|bizdev|account/i
  }
];

const GENERIC_MAILBOX_REGEX =
  /^(info|hello|contact|contactus|support|team|admin|office|mail|enquiries|inquiries|sales|marketing|media|press|partnerships?)@/i;

// Pick the best N contacts of a brand: verified first, then by role priority
// (decision makers > marketing/partnerships > sales > generic mailboxes >
// unknown roles), then oldest first. Used to cap outreach per brand.
function selectTopContacts(contacts: any[], cap: number) {
  if (!Number.isFinite(cap) || cap <= 0 || contacts.length <= cap) {
    return contacts;
  }

  const scored = contacts.map((contact: any, index: number) => {
    const email = String(contact.email || "").trim().toLowerCase();
    const roleText =
      String(contact.designation || contact.role || "").trim() +
      " " +
      email.split("@")[0];

    let tier = 5;

    for (const { tier: candidateTier, pattern } of ROLE_TIER_PATTERNS) {
      if (pattern.test(roleText)) {
        tier = candidateTier;
        break;
      }
    }

    if (tier === 5 && GENERIC_MAILBOX_REGEX.test(email)) {
      tier = 4;
    }

    const verifiedRank =
      String(contact.verificationStatus || "").trim() === "Ok" ||
      String(contact.status || "").trim() === "verified"
        ? 0
        : 1;

    return { contact, verifiedRank, tier, index };
  });

  scored.sort(
    (a, b) =>
      a.verifiedRank - b.verifiedRank || a.tier - b.tier || a.index - b.index
  );

  return scored.slice(0, cap).map((item) => item.contact);
}

const ContactModel = Contact as any;
const BrandMapModel = BrandMap as any;
const InstantlyLeadModel = InstantlyLead as any;
const InstantlyTemplateModel = InstantlyTemplate as any;
const InstantlyCampaignModel = InstantlyCampaign as any;
const PushLogModel = PushLog as any;
const BounceEventModel = BounceEvent as any;

const INSTANTLY_EXPORT_JOB_TIMEOUT_MS = Number(
  process.env.INSTANTLY_EXPORT_JOB_TIMEOUT_MS || 30 * 60 * 1000
);

type InstantlyExportJobProgress = {
  totalBrands?: number;
  processedBrands?: number;
  processedContacts?: number;
  newRows?: number;
  updatedExistingUnpushed?: number;
  skippedAlreadyPushed?: number;
  verifiedContacts?: number;
  skippedInvalidVerification?: number;
  competitorsCompanies?: number;
  competitorsUpdated?: number;
  pendingVerified?: number;
  pendingRejected?: number;
  pendingVerificationFailed?: number;
  bouncedCampaignsScanned?: number;
  bouncedRowsUpdated?: number;
  bouncedVerificationRepaired?: number;
};

type InstantlyExportJob = {
  status: "running" | "completed" | "failed";
  message: string;
  startedAt: string;
  finishedAt?: string;
  result?: any;
  error?: string;
  progress?: InstantlyExportJobProgress;
};

const instantlyExportJobs: Record<string, InstantlyExportJob> = {};

function isExportJobTimedOut(job: InstantlyExportJob) {
  if (job.status !== "running") return false;

  const startedAt = new Date(job.startedAt).getTime();

  if (!Number.isFinite(startedAt)) return false;

  return Date.now() - startedAt > INSTANTLY_EXPORT_JOB_TIMEOUT_MS;
}

function markTimedOutExportJobs() {
  for (const [jobId, job] of Object.entries(instantlyExportJobs)) {
    if (!isExportJobTimedOut(job)) continue;

    instantlyExportJobs[jobId] = {
      ...job,
      status: "failed",
      message: "Export timed out. Please start export again.",
      finishedAt: new Date().toISOString(),
      error: "Export timed out before completion."
    };
  }
}

function updateExportJobProgress(jobId: string | undefined, patch: Partial<InstantlyExportJobProgress>, message?: string) {
  if (!jobId || !instantlyExportJobs[jobId]) return;

  instantlyExportJobs[jobId] = {
    ...instantlyExportJobs[jobId],
    message: message || instantlyExportJobs[jobId].message,
    progress: {
      ...(instantlyExportJobs[jobId].progress || {}),
      ...patch
    }
  };
}


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

// Inbound = the brand contacted us first (CSV-imported inquiries), so the
// tone is a warm reply with next steps, not a cold pitch.
const DEFAULT_INBOUND_TEMPLATES: Record<string, any> = {
  "Enoylity Technology": {
    subject: "{{companyName}} x Enoylity Technology - next steps for {{productName}}",
    body:
      "Hi {{firstName}},\n\n" +
      "Thanks for reaching out about a collaboration with Enoylity Technology - great to hear from {{companyName}}.\n\n" +
      "We reviewed {{productName}} and it's a strong fit for our audience of 1M+ US tech subscribers.\n\n" +
      "Here's what a dedicated review includes:\n" +
      "- Dedicated 8-12 min full review of {{productName}}\n" +
      "- 500K+ average reach per video\n" +
      "- Your tracking link at the top of the description and pinned comment\n" +
      "- Full draft approval before publishing\n" +
      "- US shipping - we're based in Las Vegas, NV\n\n" +
      "You can see our recent brand work here: {{relatedVideo}}\n\n" +
      "To lock in a slot, just reply with your preferred timeline and where you'd ship the unit from - we'll take it from there.\n\n" +
      "Best regards,\n" +
      "{{sendingAccountFirstName}}\n" +
      "Enoylity Technology\n" +
      "{{sendingAccountEmail}}",
    followUp1:
      "Hi {{firstName}},\n\n" +
      "Following up on your inquiry about featuring {{productName}}. We're finalizing this month's review schedule and would love to include {{companyName}}.\n\n" +
      "Our recent work: {{relatedVideo}}\n\n" +
      "Reply with your preferred timeline and we'll reserve the slot.\n\n" +
      "{{sendingAccountFirstName}}",
    followUp2:
      "Hello {{firstName}},\n\n" +
      "Just closing the loop on your {{productName}} inquiry - the current review window for {{companyName}} is about to fill up.\n\n" +
      "If the timing isn't right, no problem at all - reply anytime and we'll pick it back up. If you'd like the slot, a quick \"let's go\" is enough.\n\n" +
      "{{sendingAccountFirstName}}\n" +
      "Enoylity Technology"
  },

  "MHD Tech": {
    subject: "{{companyName}} x MHD Tech - next steps for {{productName}}",
    body:
      "Hi {{firstName}},\n\n" +
      "Thanks for getting in touch with MHD Tech - happy to hear from {{companyName}}.\n\n" +
      "We took a look at {{productName}} and it fits our dedicated review format well. Our channel reaches 580K tech subscribers who actively buy what we feature.\n\n" +
      "Here's what the review includes:\n" +
      "- Dedicated 4-8 min full review of {{productName}}\n" +
      "- Your tracking link at the top of the description and pinned comment\n" +
      "- Draft shared for your approval before publishing\n" +
      "- Easy US shipping - we're based in Torrance, CA\n\n" +
      "Recent work: {{relatedVideo}}\n\n" +
      "To move forward, reply with your preferred timeline and shipping details and we'll schedule {{companyName}}'s slot.\n\n" +
      "Best,\n" +
      "{{sendingAccountFirstName}}\n" +
      "MHD Tech Team\n" +
      "{{sendingAccountEmail}}",
    followUp1:
      "Hi {{firstName}},\n\n" +
      "Circling back on your inquiry about a {{productName}} review. We're locking this month's schedule now and want to make sure {{companyName}} gets a slot.\n\n" +
      "Recent work: {{relatedVideo}}\n\n" +
      "Reply with a timeline that works and we'll confirm it.\n\n" +
      "{{sendingAccountFirstName}}",
    followUp2:
      "Hello {{firstName}},\n\n" +
      "Closing the loop on {{companyName}}'s {{productName}} inquiry - the current window is nearly full.\n\n" +
      "If now isn't the right time, just say so and we'll follow up later. Otherwise a quick reply locks the slot in.\n\n" +
      "{{sendingAccountFirstName}}\n" +
      "MHD Tech"
  }
};

function normalizeTemplateType(value: any) {
  return String(value || "").trim().toLowerCase() === "inbound"
    ? "inbound"
    : "outbound";
}

function getTemplateDefaults(channel: string, templateType: string) {
  return templateType === "inbound"
    ? DEFAULT_INBOUND_TEMPLATES[channel]
    : DEFAULT_TEMPLATES[channel];
}


function getInstantlyBouncedStatusForResponse(lead: any) {
  const value =
    cleanText(lead.instantlyBounced) ||
    cleanText(lead.instantlyBounceStatus) ||
    cleanText(lead.bouncedStatus) ||
    cleanText(lead.bounceStatus) ||
    cleanText(lead.raw?.instantlyBounced) ||
    cleanText(lead.raw?.instantlyBounceStatus) ||
    cleanText(lead.raw?.bouncedStatus) ||
    cleanText(lead.raw?.bounceStatus);

  if (value) return value;

  if (lead.isBounced || lead.raw?.isBounced) {
    const reason = cleanText(lead.bounceReason || lead.raw?.bounceReason);
    return reason ? `Bounced - ${reason}` : "Bounced";
  }

  if (cleanText(lead.bouncedAt || lead.raw?.bouncedAt)) {
    return "Bounced";
  }

  return "Not bounced";
}

function isInstantlyBouncedValue(value: any) {
  const lower = cleanText(value).toLowerCase();

  if (!lower) return false;

  return lower.includes("bounce");
}

function getVerificationStatusForResponse(lead: any) {
  const verificationStatus = cleanText(lead?.verificationStatus);

  if (
    verificationStatus.toLowerCase() === "bounced" &&
    isInstantlyBouncedValue(getInstantlyBouncedStatusForResponse(lead))
  ) {
    return "Pending Verification";
  }

  return verificationStatus;
}

function getStoredVerificationFallback(lead: any) {
  const raw = lead?.raw || {};
  const millionVerifier = raw?.millionVerifier || raw?.verification || {};

  const candidates = [
    millionVerifier.result,
    millionVerifier.status,
    millionVerifier.quality,
    raw.verificationStatus,
    raw.originalVerificationStatus
  ];

  for (const candidate of candidates) {
    const value = cleanText(candidate);

    if (!value) continue;
    if (isInstantlyBouncedValue(value)) continue;

    return normalizeVerificationStatusForStorage(value);
  }

  return "Pending Verification";
}

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
  // Rows from before the templateType field are the outbound templates.
  await InstantlyTemplateModel.updateMany(
    { templateType: { $exists: false } },
    { $set: { templateType: "outbound" } }
  );

  // Rows from before named templates become the "Default" template.
  await InstantlyTemplateModel.updateMany(
    { $or: [{ name: { $exists: false } }, { name: "" }, { name: null }] },
    { $set: { name: "Default" } }
  );

  // The legacy unique indexes ({channel} and {channel, templateType}) only
  // allow one template per channel+type — drop them so multiple named
  // templates can coexist under the new {channel, templateType, name} index.
  try {
    const indexes = await InstantlyTemplateModel.collection.indexes();

    for (const index of indexes) {
      if (["channel_1", "channel_1_templateType_1"].includes(index.name)) {
        await InstantlyTemplateModel.collection.dropIndex(index.name);
      }
    }
  } catch {
    // Best-effort cleanup; creation below still works when nothing to drop.
  }

  const channels = ["Enoylity Technology", "MHD Tech"];

  for (const channel of channels) {
    for (const templateType of ["outbound", "inbound"]) {
      const existing = await InstantlyTemplateModel.findOne({
        channel,
        templateType
      });

      if (!existing) {
        try {
          await InstantlyTemplateModel.create({
            channel,
            templateType,
            name: "Default",
            ...getTemplateDefaults(channel, templateType)
          });
        } catch {
          // Tolerate index races during first startup after the migration.
        }
      }
    }
  }
}

// Picks the template for a push: explicit templateId first, then name, then
// the channel's "Default", then any template of that channel+type.
async function resolveTemplateForPush(input: {
  channel: string;
  templateType: string;
  templateId?: string;
  templateName?: string;
}) {
  const templateId = cleanText(input.templateId);
  const templateName = cleanText(input.templateName);

  if (templateId && /^[a-f0-9]{24}$/i.test(templateId)) {
    const byId = await InstantlyTemplateModel.findById(templateId);

    if (
      byId &&
      byId.channel === input.channel &&
      normalizeTemplateType(byId.templateType) === input.templateType
    ) {
      return byId;
    }

    throw new Error(
      "Selected template was not found for " +
        input.channel +
        " (" +
        input.templateType +
        "). Refresh and pick a template again."
    );
  }

  if (templateName) {
    const byName = await InstantlyTemplateModel.findOne({
      channel: input.channel,
      templateType: input.templateType,
      name: templateName
    });

    if (byName) return byName;

    throw new Error(
      'Template "' + templateName + '" was not found for ' + input.channel + "."
    );
  }

  const byDefault = await InstantlyTemplateModel.findOne({
    channel: input.channel,
    templateType: input.templateType,
    name: "Default"
  });

  if (byDefault) return byDefault;

  return InstantlyTemplateModel.findOne({
    channel: input.channel,
    templateType: input.templateType
  }).sort({ createdAt: 1 });
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

  // Never emit an empty product: campaigns render {{productName}} in
  // subjects/bodies, and service brands have no product at all.
  return product || (brandName ? brandName + " products" : "");
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


function shouldVerifyLeadStatus(value: any) {
  const status = normalizeLeadStatus(value);

  return (
    !status ||
    status === "-" ||
    status === "not-verified" ||
    status === "not-checked" ||
    status === "pending" ||
    status === "pending-verification" ||
    status === "verification-pending"
  );
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

function isVerificationAccepted(value: any) {
  const status = normalizeLeadStatus(value);

  return [
    "ok",
    "valid",
    "verified",
    "deliverable",
    "good",
    "catch-all",
    "catchall",
    "unknown"
  ].includes(status);
}

function normalizeVerificationStatusForStorage(value: any) {
  const status = normalizeLeadStatus(value);

  if (!status || status === "-") return "Pending Verification";
  if (["ok", "valid", "verified", "deliverable", "good"].includes(status)) return "Ok";
  if (["invalid", "bad", "undeliverable"].includes(status)) return "Invalid";
  if (status.includes("catch")) return "Catch-all";
  if (status.includes("disposable")) return "Disposable";
  if (["pending", "pending-verification", "verification-pending", "not-verified", "not-checked"].includes(status)) {
    return "Pending Verification";
  }

  return cleanText(value) || "Pending Verification";
}

function shouldVerifyOnExport() {
  return envBool(process.env.INSTANTLY_VERIFY_ON_EXPORT, true);
}

function exportVerificationLimit() {
  const value = Number(process.env.INSTANTLY_EXPORT_VERIFY_LIMIT || 5000);
  return Number.isFinite(value) && value > 0 ? value : 5000;
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

function isLeadRowBounced(row: any) {
  return (
    isBounceRejected(row?.instantlyBounced) ||
    isBounceRejected(row?.gatewayBounced) ||
    Boolean(row?.raw?.instantlyBouncedAt)
  );
}

// Cross-channel bounce sync: an email that bounced in ANY channel's
// campaigns must never be pushed from another channel. Returns
// email -> channel it bounced on, for every input email with a bounced
// sibling row anywhere.
async function getCrossChannelBouncedEmails(emails: string[]) {
  const bounced = new Map<string, string>();
  const unique = Array.from(new Set(emails.filter(Boolean)));

  for (let i = 0; i < unique.length; i += 2000) {
    const chunk = unique.slice(i, i + 2000);

    const siblings = await InstantlyLeadModel.find(
      {
        email: { $in: chunk },
        $or: [
          { instantlyBounced: { $nin: ["", null] } },
          { gatewayBounced: { $nin: ["", null, "Not Checked"] } },
          { "raw.instantlyBouncedAt": { $exists: true } }
        ]
      },
      {
        email: 1,
        channel: 1,
        instantlyBounced: 1,
        gatewayBounced: 1,
        "raw.instantlyBouncedAt": 1
      }
    ).lean();

    for (const row of siblings as any[]) {
      const email = cleanEmail(row.email);

      if (email && !bounced.has(email) && isLeadRowBounced(row)) {
        bounced.set(email, cleanText(row.channel));
      }
    }
  }

  return bounced;
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
            delay: Number(process.env.DEFAULT_FOLLOWUP_1_DAYS || 2),
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
            delay: Number(process.env.DEFAULT_FOLLOWUP_2_DAYS || 5),
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
            delay: Number(process.env.DEFAULT_FOLLOWUP_3_DAYS || 0),
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
  niche?: string;
}) {
  const settings = await getAppSettings();
  const perBrandCap = Math.max(1, Number(settings.maxEmailsPerBrand) || 4);

  // Optional niche scoping: only leads whose brand belongs to the niche.
  const nicheFilter = cleanText(input.niche);
  let nicheCompanies: Set<string> | null = null;

  if (nicheFilter) {
    nicheCompanies = new Set(
      (
        await BrandMapModel.find({ niche: nicheFilter }, { brandName: 1 }).lean()
      )
        .map((row: any) => cleanText(row.brandName).toLowerCase())
        .filter(Boolean)
    );
  }

  // Brands excluded in the Brand Map must never be pushed, even if legacy
  // leads for them are already staged.
  const excludedCompanies = new Set<string>(
    (
      await BrandMapModel.find(
        { $or: [{ selectionStatus: "excluded" }, { isExcluded: true }] },
        { brandName: 1 }
      ).lean()
    )
      .map((row: any) => cleanText(row.brandName).toLowerCase())
      .filter(Boolean)
  );

  // Per-brand cap counts everything already pushed on this channel, so the
  // limit holds across campaigns — including the legacy staged backlog.
  const pushedCounts: Record<string, number> = {};

  const pushedAgg = await InstantlyLeadModel.aggregate([
    {
      $match: {
        channel: input.channel,
        pushedStatus: { $nin: ["", null] }
      }
    },
    {
      $group: {
        _id: "$companyName",
        count: { $sum: 1 }
      }
    }
  ]);

  for (const item of pushedAgg) {
    const key = cleanText(item._id).toLowerCase();

    if (key) {
      pushedCounts[key] = Number(item.count || 0);
    }
  }

  const selectedThisRun: Record<string, number> = {};

  const rows = await InstantlyLeadModel.find({
    channel: input.channel,
    email: { $exists: true, $nin: ["", null] },
    pushedStatus: { $in: ["", null] },
    instantlyBounced: { $in: ["", null] }
  }).sort({ createdAt: 1 });

  const crossChannelBounced = await getCrossChannelBouncedEmails(
    (rows as any[]).map((row) => cleanEmail(row.email))
  );

  const leadsToPush: any[] = [];
  const leadIds: any[] = [];
  const checkedGateways: Record<string, string> = {};

  for (const row of rows as any[]) {
    if (leadsToPush.length >= input.numLeads) break;

    const email = cleanEmail(row.email);

    if (!email) continue;
    if (input.usedEmails && input.usedEmails[email]) continue;

    // Bounced in another channel's campaigns → never reuse here. Stamp the
    // row too so it drops out of the selection UI going forward.
    const bouncedOnChannel = crossChannelBounced.get(email);

    if (bouncedOnChannel && bouncedOnChannel !== input.channel) {
      await InstantlyLeadModel.findByIdAndUpdate(row._id, {
        $set: {
          instantlyBounced: "Bounced",
          "raw.instantlyBounced": `Bounced (cross-channel: ${bouncedOnChannel})`,
          "raw.instantlyBouncedAt": new Date()
        }
      });
      continue;
    }

    const companyKey = cleanText(row.companyName).toLowerCase();

    if (companyKey && excludedCompanies.has(companyKey)) continue;

    if (nicheCompanies && (!companyKey || !nicheCompanies.has(companyKey))) {
      continue;
    }

    if (
      companyKey &&
      (pushedCounts[companyKey] || 0) + (selectedThisRun[companyKey] || 0) >=
        perBrandCap
    ) {
      continue;
    }

    let verificationStatus = cleanText(row.verificationStatus);

    if (shouldVerifyLeadStatus(verificationStatus)) {
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

    gatewayStatus = cleanText(row.gatewayBounced);

    if (!gatewayStatus || gatewayStatus === "-" || gatewayStatus === "Not Checked") {
      const gatewayDomain = getDomainFromEmail(row.email);
      gatewayStatus = await checkEmailGateway(gatewayDomain);

      await InstantlyLeadModel.updateOne(
        { _id: row._id },
        { $set: { gatewayBounced: gatewayStatus } }
      );

      row.gatewayBounced = gatewayStatus;
    }

    if (gatewayStatus !== "Safe") {
      continue;
    }

    leadsToPush.push(row);
    leadIds.push(row._id);

    if (companyKey) {
      selectedThisRun[companyKey] = (selectedThisRun[companyKey] || 0) + 1;
    }

    if (input.usedEmails) {
      input.usedEmails[email] = true;
    }
  }

  return { leadsToPush, leadIds };
}

// Id-based eligibility for campaign-from-selected-leads. Enforces the SAME
// protections as getEligibleLeads (no re-push, cross-channel bounce, excluded
// companies, per-company cap, live verify + gateway) — the user picking a lead
// does NOT bypass safety. Rejected leads are returned with a reason.
async function getEligibleLeadsByIds(input: {
  channel: string;
  leadIds: string[];
}) {
  const settings = await getAppSettings();
  const perBrandCap = Math.max(1, Number(settings.maxEmailsPerBrand) || 4);

  const validObjectIds = input.leadIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const rows = await InstantlyLeadModel.find({
    _id: { $in: validObjectIds },
    channel: input.channel
  });

  const excludedCompanies = new Set<string>(
    (
      await BrandMapModel.find(
        { $or: [{ selectionStatus: "excluded" }, { isExcluded: true }] },
        { brandName: 1 }
      ).lean()
    )
      .map((row: any) => cleanText(row.brandName).toLowerCase())
      .filter(Boolean)
  );

  const pushedCounts: Record<string, number> = {};

  const pushedAgg = await InstantlyLeadModel.aggregate([
    {
      $match: {
        channel: input.channel,
        pushedStatus: { $nin: ["", null] }
      }
    },
    { $group: { _id: "$companyName", count: { $sum: 1 } } }
  ]);

  for (const item of pushedAgg) {
    const key = cleanText(item._id).toLowerCase();
    if (key) pushedCounts[key] = Number(item.count || 0);
  }

  const selectedThisRun: Record<string, number> = {};
  const leadsToPush: any[] = [];
  const leadIds: any[] = [];
  const rejected: Array<{ id: string; email: string; reason: string }> = [];
  const checkedGateways: Record<string, string> = {};

  const crossChannelBounced = await getCrossChannelBouncedEmails(
    (rows as any[]).map((row) => cleanEmail(row.email))
  );

  for (const row of rows as any[]) {
    const id = String(row._id);
    const email = cleanEmail(row.email);

    if (!email) {
      rejected.push({ id, email: "", reason: "Missing email" });
      continue;
    }

    if (cleanText(row.pushedStatus)) {
      rejected.push({ id, email, reason: "Already pushed" });
      continue;
    }

    if (!isBounceRejectedEmpty(row.instantlyBounced)) {
      rejected.push({ id, email, reason: "Bounced in Instantly" });
      continue;
    }

    // Bounced in another channel's campaigns → never reuse here. Stamp the
    // row too so it drops out of the selection UI going forward.
    const bouncedOnChannel = crossChannelBounced.get(email);

    if (bouncedOnChannel && bouncedOnChannel !== input.channel) {
      await InstantlyLeadModel.findByIdAndUpdate(row._id, {
        $set: {
          instantlyBounced: "Bounced",
          "raw.instantlyBounced": `Bounced (cross-channel: ${bouncedOnChannel})`,
          "raw.instantlyBouncedAt": new Date()
        }
      });
      rejected.push({
        id,
        email,
        reason: `Bounced on ${bouncedOnChannel} (cross-channel sync)`
      });
      continue;
    }

    const companyKey = cleanText(row.companyName).toLowerCase();

    if (companyKey && excludedCompanies.has(companyKey)) {
      rejected.push({ id, email, reason: "Brand is excluded" });
      continue;
    }

    if (
      companyKey &&
      (pushedCounts[companyKey] || 0) + (selectedThisRun[companyKey] || 0) >=
        perBrandCap
    ) {
      rejected.push({
        id,
        email,
        reason: "Per-brand cap reached (" + perBrandCap + ")"
      });
      continue;
    }

    let verificationStatus = cleanText(row.verificationStatus);

    if (shouldVerifyLeadStatus(verificationStatus)) {
      const verifyResult = await verifyEmailWithMillionVerifier(email);
      verificationStatus = verifyResult.status;

      await InstantlyLeadModel.findByIdAndUpdate(row._id, {
        $set: {
          verificationStatus,
          raw: { ...(row.raw || {}), millionVerifier: verifyResult.raw }
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (isVerificationRejected(verificationStatus)) {
      rejected.push({ id, email, reason: "Failed verification" });
      continue;
    }

    let gatewayStatus = cleanText(row.gatewayBounced);

    if (!gatewayStatus || gatewayStatus === "-" || gatewayStatus === "Not Checked") {
      const domain = getDomainFromEmail(email);
      gatewayStatus =
        (domain && checkedGateways[domain]) ||
        (await checkEmailGateway(domain));
      if (domain) checkedGateways[domain] = gatewayStatus;

      await InstantlyLeadModel.updateOne(
        { _id: row._id },
        { $set: { gatewayBounced: gatewayStatus } }
      );
      row.gatewayBounced = gatewayStatus;
    }

    if (isBounceRejected(gatewayStatus) || gatewayStatus !== "Safe") {
      rejected.push({ id, email, reason: "Gateway not safe (" + gatewayStatus + ")" });
      continue;
    }

    if (!isEligibleForInstantlyPush(row)) {
      rejected.push({ id, email, reason: "Not eligible for push" });
      continue;
    }

    leadsToPush.push(row);
    leadIds.push(row._id);

    if (companyKey) {
      selectedThisRun[companyKey] = (selectedThisRun[companyKey] || 0) + 1;
    }
  }

  return { leadsToPush, leadIds, rejected };
}

function isBounceRejectedEmpty(value: any) {
  const text = cleanText(value).toLowerCase();
  return text === "" || text === "not bounced";
}

// Instantly has no campaign folders; custom tags are the grouping mechanism.
// Tag label → id cache lives for the process lifetime.
const instantlyTagCache: Record<string, string> = {};

async function ensureInstantlyTag(label: string): Promise<string> {
  const cleanLabel = cleanText(label);

  if (!cleanLabel) return "";

  const cacheKey = cleanLabel.toLowerCase();

  if (instantlyTagCache[cacheKey]) {
    return instantlyTagCache[cacheKey];
  }

  const listResp = await instantlyApiCall(
    "GET",
    "/custom-tags?search=" + encodeURIComponent(cleanLabel) + "&limit=100"
  );

  const items = Array.isArray(listResp?.items)
    ? listResp.items
    : Array.isArray(listResp)
      ? listResp
      : [];

  const existing = items.find(
    (item: any) => cleanText(item.label).toLowerCase() === cacheKey
  );

  if (existing?.id) {
    instantlyTagCache[cacheKey] = String(existing.id);
    return instantlyTagCache[cacheKey];
  }

  const createResp = await instantlyApiCall("POST", "/custom-tags", {
    label: cleanLabel,
    description: "Niche tag (auto-created by Outreach CRM)"
  });

  const tagId = String(createResp?.id || "");

  if (tagId) {
    instantlyTagCache[cacheKey] = tagId;
  }

  return tagId;
}

async function deriveNichesFromLeads(leads: any[], explicitNiche?: string) {
  const niches: string[] = [];
  const explicit = cleanText(explicitNiche);

  if (explicit) {
    niches.push(explicit);
  }

  const brandMapIds = Array.from(
    new Set(
      leads
        .map((lead: any) => String(lead.brandMapId || ""))
        .filter((id: string) => id && id !== "null" && id !== "undefined")
    )
  );

  if (brandMapIds.length > 0) {
    const brandRows = await BrandMapModel.find(
      { _id: { $in: brandMapIds } },
      { niche: 1 }
    ).lean();

    const counts = new Map<string, number>();

    for (const row of brandRows as any[]) {
      const niche = cleanText(row.niche);

      if (!niche || niche === "-" || niche.toLowerCase() === "n/a") continue;

      counts.set(niche, (counts.get(niche) || 0) + 1);
    }

    const ranked = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([niche]) => niche);

    for (const niche of ranked) {
      if (!niches.some((item) => item.toLowerCase() === niche.toLowerCase())) {
        niches.push(niche);
      }
    }
  }

  return niches;
}

async function assignNicheTagsToCampaign(campaignId: string, niches: string[]) {
  const tagIds: string[] = [];

  for (const niche of niches.slice(0, 3)) {
    const tagId = await ensureInstantlyTag(niche);

    if (tagId) {
      tagIds.push(tagId);
    }
  }

  if (tagIds.length === 0) {
    return tagIds;
  }

  await instantlyApiCall("POST", "/custom-tags/toggle-resource", {
    tag_ids: tagIds,
    resource_type: 2,
    resource_ids: [campaignId],
    assign: true
  });

  return tagIds;
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
  niche?: string;
  templateType?: string;
  templateId?: string;
  templateName?: string;
  explicitLeads?: { leadsToPush: any[]; leadIds: any[] };
}) {
  await ensureTemplates();

  const templateType = normalizeTemplateType(input.templateType);
  const template = await resolveTemplateForPush({
    channel: input.channel,
    templateType,
    templateId: input.templateId,
    templateName: input.templateName
  });

  if (!template) {
    throw new Error(
      `${templateType} template not found for ` + input.channel
    );
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


  // Id-based campaigns pass their already-validated leads; count-based
  // campaigns select them here.
  const { leadsToPush, leadIds } = input.explicitLeads
    ? input.explicitLeads
    : await getEligibleLeads({
        channel: input.channel,
        numLeads: input.numLeads,
        usedEmails: input.usedEmails,
        niche: input.niche
      });

  if (leadsToPush.length === 0) {
    throw new Error("No valid eligible leads found after verification and gateway check.");
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
        pushedAt,
        campaignId,
        campaignName: input.campaignName
      }
    });

    await ContactModel.updateMany(
      { email: lead.email },
      {
        $set: {
          status: "pushed",
          pushedAt,
          instantlyCampaignId: campaignId
        }
      }
    );

    totalPushed += 1;
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.INSTANTLY_LEAD_PUSH_DELAY_MS || 50)));
  }

  const campaignLaunchStatus = getCampaignLaunchStatus(input.startDate);

  let activatedAt: Date | undefined;

  await instantlyApiCall("POST", "/campaigns/" + campaignId + "/activate", {});
  activatedAt = new Date();

  // Niche tagging groups campaigns in Instantly. A tag failure must never
  // fail the push — leads are already in the campaign by this point.
  let campaignNiches: string[] = [];
  let campaignTagIds: string[] = [];
  let tagError = "";

  try {
    campaignNiches = await deriveNichesFromLeads(leadsToPush, input.niche);
    campaignTagIds = await assignNicheTagsToCampaign(campaignId, campaignNiches);
  } catch (error: any) {
    tagError = cleanText(error?.message || String(error));
    console.error("Niche tag assignment failed (push unaffected):", tagError);
  }

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
    niche: campaignNiches[0] || "",
    niches: campaignNiches,
    tagIds: campaignTagIds,
    tagError,
    templateName: cleanText(template.name) || "Default",
    raw: {
      createResp,
      payload,
      templateName: cleanText(template.name) || "Default",
      templateId: String(template._id || "")
    }
  });

  await PushLogModel.create({
    channel: input.channel,
    campaignName: input.campaignName,
    campaignId,
    totalPushed,
    dailyLimit: input.dailyLimit,
    status: "Success",
    message:
      totalPushed +
      ' leads pushed to "' +
      input.campaignName +
      '" using template "' +
      (cleanText(template.name) || "Default") +
      '"',
    raw: {
      leads: leadsToPush.map((lead) => lead.email),
      selectedSenders: campaignSenders,
      templateName: cleanText(template.name) || "Default"
    }
  });

  return {
    campaignId,
    totalPushed,
    templateName: cleanText(template.name) || "Default"
  };
}

function parseJsonFromAiText(text: string) {
  const cleaned = String(text || "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : JSON.parse(cleaned);
}

function parseCompetitorBatchResponse(text: string, requestedCompanies: string[]) {
  const parsed = parseJsonFromAiText(text);
  const rows = Array.isArray(parsed?.results)
    ? parsed.results
    : Array.isArray(parsed)
      ? parsed
      : parsed?.competitor1 || parsed?.competitor2
        ? [{ brand: requestedCompanies[0], ...parsed }]
        : [];

  const byCompany: Record<string, { competitor1: string; competitor2: string }> = {};

  for (const row of rows) {
    const brand = cleanText(
      row.brand || row.companyName || row.company || row.name || row.Brand
    );

    if (!brand) continue;

    const competitor1 = cleanText(
      row.competitor1 || row.Competitor1 || row["Competitor 1"]
    );
    const competitor2 = cleanText(
      row.competitor2 || row.Competitor2 || row["Competitor 2"]
    );

    if (!competitor1 && !competitor2) continue;

    byCompany[brand.toLowerCase()] = { competitor1, competitor2 };
  }

  return byCompany;
}

async function askOpenAIForCompetitorBatch(companyNames: string[]) {
  const cleanCompanies = Array.from(
    new Set(companyNames.map(cleanText).filter(Boolean))
  );

  if (cleanCompanies.length === 0) {
    return {} as Record<string, { competitor1: string; competitor2: string }>;
  }

  const prompt =
    "For each company below, find 2 direct competitor brands in the same product category.\n\n" +
    cleanCompanies.map((name, index) => `${index + 1}. ${name}`).join("\n") +
    "\n\nRules:\n" +
    "1. Return direct competitors only.\n" +
    "2. Return brand names only, not product names.\n" +
    "3. Do not return the original company as its own competitor.\n" +
    "4. No explanations.\n" +
    "5. Output exactly valid JSON in this shape:\n" +
    '{"results":[{"brand":"Company Name","competitor1":"Brand A","competitor2":"Brand B"}]}';

  try {
    // Uses the AI provider/model configured in Settings (OpenAI, Gemini or
    // Claude) — no hardcoded env key.
    const text = (
      await generateAiText({
        prompt,
        system:
          "You are a market research assistant. Always respond with valid JSON only.",
        temperature: 0.2
      })
    ).trim();

    return parseCompetitorBatchResponse(text, cleanCompanies);
  } catch (error: any) {
    console.error(
      "Competitor AI batch failed:",
      error?.response?.data || error.message
    );

    return {} as Record<string, { competitor1: string; competitor2: string }>;
  }
}

async function getCompetitorFallbackFromBrandMap(companyName: string) {
  const company = cleanText(companyName);

  if (!company) {
    return { competitor1: "", competitor2: "" };
  }

  try {
    const brandMap = await BrandMapModel.findOne({
      brandName: new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    }).lean();

    const candidates: string[] = [];

    if (brandMap?.niche) {
      const related = await BrandMapModel.find({
        niche: brandMap.niche,
        brandName: { $exists: true, $nin: ["", null] }
      })
        .sort({ channelCount: -1, mostRecentSponsorshipDate: -1, updatedAt: -1 })
        .limit(10)
        .lean();

      for (const row of related as any[]) {
        const name = cleanText(row.brandName);

        if (!name || name.toLowerCase() === company.toLowerCase()) continue;
        if (candidates.map((item) => item.toLowerCase()).includes(name.toLowerCase())) continue;

        candidates.push(name);
        if (candidates.length >= 2) break;
      }
    }

    const seedBrand = cleanText(brandMap?.seedBrandName);

    if (
      seedBrand &&
      seedBrand.toLowerCase() !== company.toLowerCase() &&
      !candidates.map((item) => item.toLowerCase()).includes(seedBrand.toLowerCase())
    ) {
      candidates.push(seedBrand);
    }

    return {
      competitor1: candidates[0] || "",
      competitor2: candidates[1] || ""
    };
  } catch (error: any) {
    console.error("Competitor fallback failed for", companyName, error.message);
    return { competitor1: "", competitor2: "" };
  }
}

async function askOpenAIForCompetitors(companyName: string) {
  const byCompany = await askOpenAIForCompetitorBatch([companyName]);
  const competitors = byCompany[cleanText(companyName).toLowerCase()];

  if (competitors?.competitor1 || competitors?.competitor2) {
    return competitors;
  }

  return getCompetitorFallbackFromBrandMap(companyName);
}

function missingCompetitorQuery(extra: Record<string, any> = {}) {
  const query: Record<string, any> = { ...extra };
  const companyFilter = extra.companyName;

  if (companyFilter && typeof companyFilter === "object" && !Array.isArray(companyFilter)) {
    query.companyName = { $exists: true, $nin: ["", null], ...companyFilter };
  } else if (companyFilter) {
    query.companyName = companyFilter;
  } else {
    query.companyName = { $exists: true, $nin: ["", null] };
  }

  query.$or = [
    { competitor1: { $exists: false } },
    { competitor1: "" },
    { competitor1: null },
    { competitor1: "-" },
    { competitor2: { $exists: false } },
    { competitor2: "" },
    { competitor2: null },
    { competitor2: "-" }
  ];

  return query;
}

export async function fillCompetitorsForCompanies(companyNames: string[]) {
  const uniqueCompanies = Array.from(
    new Set(
      companyNames
        .map((name) => cleanText(name))
        .filter(Boolean)
    )
  );

  if (uniqueCompanies.length === 0) {
    return { companies: 0, updated: 0, failed: 0, stillEmpty: 0, data: [] as any[] };
  }

  const rowsNeedingCompetitors = await InstantlyLeadModel.find(
    missingCompetitorQuery({ companyName: { $in: uniqueCompanies } })
  )
    .select("companyName")
    .lean();

  const companiesToFill = Array.from(
    new Set(
      (rowsNeedingCompetitors as any[])
        .map((row) => cleanText(row.companyName))
        .filter(Boolean)
    )
  );

  let updated = 0;
  let failed = 0;
  const results: any[] = [];
  const batchSize = Math.max(Number(process.env.COMPETITOR_FILL_BATCH_SIZE || 20), 1);

  for (let index = 0; index < companiesToFill.length; index += batchSize) {
    const batch = companiesToFill.slice(index, index + batchSize);
    const byCompany = await askOpenAIForCompetitorBatch(batch);

    for (const companyName of batch) {
      let competitors = byCompany[companyName.toLowerCase()];

      if (!competitors?.competitor1 && !competitors?.competitor2) {
        competitors = await getCompetitorFallbackFromBrandMap(companyName);
      }

      const competitor1 = cleanText(competitors?.competitor1);
      const competitor2 = cleanText(competitors?.competitor2);

      if (!competitor1 && !competitor2) {
        failed += 1;
        results.push({
          companyName,
          competitor1: "",
          competitor2: "",
          updated: 0,
          skipped: true,
          reason: "competitors_not_found"
        });
        continue;
      }

      const result = await InstantlyLeadModel.updateMany(
        missingCompetitorQuery({ companyName }),
        {
          $set: {
            competitor1,
            competitor2
          }
        }
      );

      updated += result.modifiedCount || 0;

      results.push({
        companyName,
        competitor1,
        competitor2,
        updated: result.modifiedCount || 0
      });
    }

    await new Promise((resolve) => setTimeout(resolve, Number(process.env.INSTANTLY_LEAD_PUSH_DELAY_MS || 50)));
  }

  const stillEmpty = await InstantlyLeadModel.countDocuments(
    missingCompetitorQuery({ companyName: { $in: uniqueCompanies } })
  );

  return {
    companies: companiesToFill.length,
    updated,
    failed,
    stillEmpty,
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


async function safeUpsertInstantlyLead(input: any) {
  const channel = cleanText(input.channel);
  const email = cleanEmail(input.email);

  if (!channel || !email) {
    return { lead: null, created: false, updated: false, skipped: true };
  }

  const existing = await InstantlyLeadModel.findOne({ channel, email });

  if (existing && cleanText(existing.pushedStatus)) {
    return { lead: existing, created: false, updated: false, skipped: true };
  }

  // Cross-channel bounce sync: a brand-new row for an email that already
  // bounced in any channel's campaigns inherits the bounce, so it can
  // never be selected or pushed from this channel either.
  let inheritedBounce = "";

  if (!existing) {
    const bouncedSibling = await InstantlyLeadModel.findOne(
      {
        email,
        $or: [
          { instantlyBounced: { $nin: ["", null] } },
          { gatewayBounced: { $nin: ["", null, "Not Checked"] } },
          { "raw.instantlyBouncedAt": { $exists: true } }
        ]
      },
      {
        instantlyBounced: 1,
        gatewayBounced: 1,
        "raw.instantlyBouncedAt": 1
      }
    ).lean();

    if (bouncedSibling && isLeadRowBounced(bouncedSibling)) {
      inheritedBounce = "Bounced";
    }
  }

  const payload = {
    ...input,
    channel,
    email
  };

  delete payload._id;

  const insertDefaults = {
    pushedStatus: cleanText(input.pushedStatus) || "",
    instantlyBounced: cleanText(input.instantlyBounced) || inheritedBounce,
    gatewayBounced: cleanText(input.gatewayBounced) || "",
    competitor1: cleanText(input.competitor1) || "",
    competitor2: cleanText(input.competitor2) || ""
  };

  delete payload.pushedStatus;
  delete payload.instantlyBounced;
  delete payload.gatewayBounced;
  delete payload.competitor1;
  delete payload.competitor2;

  try {
    const lead = await InstantlyLeadModel.findOneAndUpdate(
      { channel, email },
      {
        $set: payload,
        $setOnInsert: insertDefaults
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true
      }
    );

    return {
      lead,
      created: !existing,
      updated: Boolean(existing),
      skipped: false
    };
  } catch (error: any) {
    if (error && error.code === 11000) {
      const latest = await InstantlyLeadModel.findOne({ channel, email });

      if (latest && cleanText(latest.pushedStatus)) {
        return { lead: latest, created: false, updated: false, skipped: true };
      }

      const lead = await InstantlyLeadModel.findOneAndUpdate(
        { channel, email },
        { $set: payload },
        { returnDocument: "after" }
      );

      return { lead, created: false, updated: true, skipped: false };
    }

    throw error;
  }
}

export async function getInstantlyLeads(req: Request, res: Response) {
  try {
    const filter: Record<string, any> = {};

    if (req.query.channel) {
      filter.channel = String(req.query.channel);
    }

    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 5000)
        : 2000;

    const rows = await InstantlyLeadModel.find(filter)
      .select("-raw -releaseHistory")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();


    const data = rows.map((row: any) => {
      const lead = row.toObject ? row.toObject() : row;

      return {
        ...lead,
        verificationStatus: getVerificationStatusForResponse(lead),
        instantlyBounced: getInstantlyBouncedStatusForResponse(lead)
      };
    });

    const total = await InstantlyLeadModel.countDocuments(filter);

    res.json({
      success: true,
      count: data.length,
      total,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

type ExportVerificationCacheValue = {
  status: string;
  raw?: any;
};

async function resolveVerificationForExport(input: {
  contact: any;
  email: string;
  cache: Record<string, ExportVerificationCacheValue>;
  verifyOnExport: boolean;
  canVerifyMore: () => boolean;
  onVerified: () => void;
}) {
  const existingStatus = normalizeVerificationStatusForStorage(
    input.contact.verificationStatus || input.contact.status
  );

  if (isVerificationAccepted(existingStatus) || isVerificationRejected(existingStatus)) {
    return existingStatus;
  }

  if (!input.verifyOnExport || !input.canVerifyMore()) {
    return "Pending Verification";
  }

  const cached = input.cache[input.email];

  if (cached) {
    return cached.status;
  }

  try {
    const verifyResult = await verifyEmailWithMillionVerifier(input.email);
    const status = normalizeVerificationStatusForStorage(verifyResult.status);

    input.cache[input.email] = {
      status,
      raw: verifyResult.raw
    };

    input.onVerified();

    if (input.contact?._id) {
      await ContactModel.updateOne(
        { _id: input.contact._id },
        {
          $set: {
            verificationStatus: status,
            raw: {
              ...(input.contact.raw || {}),
              millionVerifier: verifyResult.raw
            }
          }
        }
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 120));

    return status;
  } catch (error: any) {
    console.error("Export verification failed for", input.email, error?.message || error);
    return "Pending Verification";
  }
}


function buildPendingVerificationFilter(channel?: string) {
  const filter: Record<string, any> = {
    email: { $exists: true, $nin: ["", null] },
    $or: [
      { verificationStatus: { $exists: false } },
      { verificationStatus: "" },
      { verificationStatus: null },
      { verificationStatus: "Pending Verification" },
      { verificationStatus: "pending" },
      { verificationStatus: "pending verification" },
      { verificationStatus: "Not Verified" },
      { verificationStatus: "Not Checked" },
      { verificationStatus: "Unknown" }
    ]
  };

  if (channel) filter.channel = channel;

  return filter;
}

async function verifyPendingInstantlyLeadsInternal(input: {
  channel?: string;
  limit?: number;
} = {}) {
  const requestedLimit = Number(input.limit || process.env.INSTANTLY_BACKGROUND_VERIFY_LIMIT || 1000);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 5000))
    : 1000;
  const filter = buildPendingVerificationFilter(input.channel);

  const rows = await InstantlyLeadModel.find(filter)
    .sort({ createdAt: 1 })
    .limit(limit);

  let verified = 0;
  let rejected = 0;
  let failed = 0;
  const results: any[] = [];
  const cache: Record<string, ExportVerificationCacheValue> = {};

  for (const row of rows as any[]) {
    const email = cleanEmail(row.email);

    if (!email) continue;

    try {
      const cached = cache[email];
      const verifyResult = cached
        ? { status: cached.status, raw: cached.raw }
        : await verifyEmailWithMillionVerifier(email);
      const status = normalizeVerificationStatusForStorage(verifyResult.status);
      const contactStatus = isVerificationAccepted(status)
        ? "verified"
        : isVerificationRejected(status)
          ? "invalid"
          : "verification_pending";

      cache[email] = { status, raw: verifyResult.raw };

      await InstantlyLeadModel.updateMany(
        { email },
        {
          $set: {
            verificationStatus: status,
            "raw.millionVerifier": verifyResult.raw
          }
        }
      );

      await ContactModel.updateMany(
        { email },
        {
          $set: {
            verificationStatus: status,
            status: contactStatus,
            "raw.millionVerifier": verifyResult.raw,
            verifiedAt: new Date()
          }
        }
      );

      verified += 1;
      if (isVerificationRejected(status)) rejected += 1;

      results.push({ email, status });
      await new Promise((resolve) => setTimeout(resolve, 120));
    } catch (error: any) {
      failed += 1;
      results.push({
        email,
        status: "Pending Verification",
        error: error?.message || String(error)
      });
    }
  }

  return {
    scanned: rows.length,
    verified,
    rejected,
    failed,
    remaining: Math.max(0, await InstantlyLeadModel.countDocuments(filter)),
    data: results
  };
}

async function repairBouncedVerificationStatusesInternal(input: { channel?: string } = {}) {
  const filter: Record<string, any> = {
    verificationStatus: /^bounced$/i,
    $or: [
      { instantlyBounced: /bounce/i },
      { instantlyBounceStatus: /bounce/i },
      { bouncedStatus: /bounce/i },
      { bounceStatus: /bounce/i },
      { "raw.instantlyBounced": /bounce/i },
      { "raw.instantlyBounceStatus": /bounce/i },
      { "raw.bouncedStatus": /bounce/i },
      { "raw.bounceStatus": /bounce/i },
      { "raw.instantlyBouncedAt": { $exists: true } }
    ]
  };

  if (input.channel) filter.channel = input.channel;

  const leads: any[] = await InstantlyLeadModel.find(filter).lean();
  let leadsUpdated = 0;

  for (const lead of leads) {
    const verificationStatus = getStoredVerificationFallback(lead);

    await InstantlyLeadModel.updateOne(
      { _id: lead._id },
      {
        $set: {
          verificationStatus,
          "raw.verificationStatusRepairedFromBounce": true,
          "raw.verificationStatusRepairedAt": new Date()
        }
      }
    );

    leadsUpdated += 1;
  }

  const contacts: any[] = await ContactModel.find({
    verificationStatus: /^bounced$/i,
    $or: [
      { "raw.instantlyBouncedAt": { $exists: true } },
      { "raw.instantlyBounced": /bounce/i }
    ]
  })
    .select("_id raw")
    .lean();

  let contactsUpdated = 0;

  for (const contact of contacts) {
    const verificationStatus = getStoredVerificationFallback(contact);

    await ContactModel.updateOne(
      { _id: contact._id },
      {
        $set: {
          verificationStatus,
          "raw.verificationStatusRepairedFromInstantlyBounce": true,
          "raw.verificationStatusRepairedAt": new Date()
        }
      }
    );

    contactsUpdated += 1;
  }

  return {
    success: true,
    leadsUpdated,
    contactsUpdated,
    totalUpdated: leadsUpdated + contactsUpdated
  };
}

async function fillMissingCompetitorsInternal(input: { channel?: string } = {}) {
  const filter: Record<string, any> = missingCompetitorQuery();

  if (input.channel) filter.channel = input.channel;

  const rows: any[] = await InstantlyLeadModel.find(filter)
    .select("companyName")
    .sort({ companyName: 1 })
    .lean();

  const companies: string[] = Array.from(
    new Set(
      rows
        .map((row: any) => cleanText(row.companyName))
        .filter((companyName: string) => companyName.length > 0)
    )
  );

  return fillCompetitorsForCompanies(companies);
}

async function pullBouncedFromInstantlyInternal(mode: "all" | "crm" = "all") {
  const campaignIds = await getCampaignIdsForBounceMode(mode);

  if (campaignIds.length === 0) {
    return {
      mode,
      campaignsScanned: 0,
      uniqueBouncedEmails: 0,
      totalUpdated: 0,
      message: "No campaigns found for selected mode"
    };
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
        const email = cleanEmail(
          item.email || item?.lead?.email || item?.data?.email
        );

        if (!email) continue;

        bouncedEmails[email] = true;

        await BounceEventModel.create({
          email,
          campaignId,
          eventType: "bounced",
          reason: item.status || item.reason || "FILTER_VAL_BOUNCED",
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
          instantlyBounced: "Bounced",
          "raw.instantlyBounced": "Bounced",
          "raw.instantlyBouncedAt": new Date()
        }
      }
    );

    await ContactModel.updateMany(
      { email },
      {
        $set: {
          "raw.instantlyBounced": "Bounced",
          "raw.instantlyBouncedAt": new Date()
        }
      }
    );

    totalUpdated += leadResult.modifiedCount || 0;
  }

  return {
    mode,
    campaignsScanned: campaignIds.length,
    uniqueBouncedEmails: emails.length,
    totalUpdated
  };
}

async function runInstantlyBackendMaintenance(input: {
  channel?: string;
  jobId?: string;
  reason?: string;
} = {}) {
  const result: any = {
    success: true,
    reason: input.reason || "background",
    bounced: null,
    bouncedVerificationRepair: null,
    verification: null,
    competitors: null,
    errors: [] as any[]
  };

  if (envBool(process.env.INSTANTLY_BACKGROUND_PULL_BOUNCED, true)) {
    try {
      updateExportJobProgress(input.jobId, {}, "Refreshing Instantly bounced statuses...");
      result.bounced = await pullBouncedFromInstantlyInternal("all");
      updateExportJobProgress(input.jobId, {
        bouncedCampaignsScanned: result.bounced.campaignsScanned || 0,
        bouncedRowsUpdated: result.bounced.totalUpdated || 0
      });
    } catch (error: any) {
      console.error("Background bounced sync failed:", error?.message || error);
      result.errors.push({ step: "bounced", message: error?.message || String(error) });
    }
  }

  try {
    result.bouncedVerificationRepair = await repairBouncedVerificationStatusesInternal({
      channel: input.channel
    });
    updateExportJobProgress(input.jobId, {
      bouncedVerificationRepaired: result.bouncedVerificationRepair.totalUpdated || 0
    });
  } catch (error: any) {
    console.error("Bounced verification repair failed:", error?.message || error);
    result.errors.push({ step: "bounced-verification-repair", message: error?.message || String(error) });
  }

  if (envBool(process.env.INSTANTLY_BACKGROUND_VERIFY_PENDING, true)) {
    try {
      updateExportJobProgress(input.jobId, {}, "Verifying pending Instantly leads...");
      result.verification = await verifyPendingInstantlyLeadsInternal({
        channel: input.channel,
        limit: Number(process.env.INSTANTLY_BACKGROUND_VERIFY_LIMIT || 1000)
      });
      updateExportJobProgress(input.jobId, {
        pendingVerified: result.verification.verified || 0,
        pendingRejected: result.verification.rejected || 0,
        pendingVerificationFailed: result.verification.failed || 0
      });
    } catch (error: any) {
      console.error("Background verification failed:", error?.message || error);
      result.errors.push({ step: "verification", message: error?.message || String(error) });
    }
  }

  if (envBool(process.env.INSTANTLY_BACKGROUND_FILL_COMPETITORS, true)) {
    try {
      updateExportJobProgress(input.jobId, {}, "Filling competitor columns...");
      result.competitors = await fillMissingCompetitorsInternal({ channel: input.channel });
      updateExportJobProgress(input.jobId, {
        competitorsCompanies: result.competitors.companies || 0,
        competitorsUpdated: result.competitors.updated || 0
      });
    } catch (error: any) {
      console.error("Background competitor fill failed:", error?.message || error);
      result.errors.push({ step: "competitors", message: error?.message || String(error) });
    }
  }

  return result;
}

let instantlyMaintenanceRunning = false;
let instantlyMaintenancePending: null | { channel?: string; reason?: string } = null;
let instantlyMaintenanceLastStartedAt = 0;

export function scheduleInstantlyBackendMaintenance(input: {
  channel?: string;
  reason?: string;
  force?: boolean;
} = {}) {
  if (!envBool(process.env.INSTANTLY_BACKGROUND_MAINTENANCE_ENABLED, true)) return;

  if (instantlyMaintenanceRunning) {
    instantlyMaintenancePending = { channel: input.channel, reason: input.reason || "queued" };
    return;
  }

  const debounceMs = Number(process.env.INSTANTLY_BACKGROUND_MAINTENANCE_DEBOUNCE_MS || 2 * 60 * 1000);

  if (!input.force && Date.now() - instantlyMaintenanceLastStartedAt < debounceMs) {
    return;
  }

  instantlyMaintenanceRunning = true;
  instantlyMaintenanceLastStartedAt = Date.now();

  setImmediate(async () => {
    try {
      await runInstantlyBackendMaintenance({
        channel: input.channel,
        reason: input.reason || "scheduled"
      });
    } catch (error: any) {
      console.error("Scheduled Instantly backend maintenance failed:", error?.message || error);
    } finally {
      instantlyMaintenanceRunning = false;

      if (instantlyMaintenancePending) {
        const next = instantlyMaintenancePending;
        instantlyMaintenancePending = null;
        scheduleInstantlyBackendMaintenance({ ...next, force: true });
      }
    }
  });
}

async function runInstantlyExportNow(input: { brandName?: string; jobId?: string } = {}) {
  const brandNameFilter = cleanText(input.brandName);
  const settings = await getAppSettings();

  const brandMapQuery: Record<string, any> = {
    isExcluded: { $ne: true },
    selectionStatus: { $ne: "excluded" }
  };

  // Manual mode: export only stages brands that were approved in the
  // Brand Map, instead of vacuuming every brand ever discovered.
  if (settings.manualSelectionMode) {
    brandMapQuery.selectionStatus = "approved";
  }

  if (brandNameFilter) {
    brandMapQuery.brandName = brandNameFilter;
  }

  const brandMaps = await BrandMapModel.find(brandMapQuery).sort({
    createdAt: -1
  });

  updateExportJobProgress(
    input.jobId,
    {
      totalBrands: brandMaps.length,
      processedBrands: 0,
      processedContacts: 0,
      newRows: 0,
      updatedExistingUnpushed: 0,
      skippedAlreadyPushed: 0,
      verifiedContacts: 0,
      skippedInvalidVerification: 0,
      competitorsCompanies: 0,
      competitorsUpdated: 0,
      pendingVerified: 0,
      pendingRejected: 0,
      bouncedRowsUpdated: 0
    },
    "Preparing clean Instantly leads..."
  );

  let exported = 0;
  let skippedAlreadyExported = 0;
  let updatedExistingUnpushed = 0;
  let contactsNormalized = 0;
  let processedContacts = 0;
  let skippedInvalidVerification = 0;
  const processedChannelEmails = new Set<string>();

  for (let brandIndex = 0; brandIndex < brandMaps.length; brandIndex += 1) {
    const brandMap = brandMaps[brandIndex] as any;
    const brandName = cleanText(brandMap.brandName);
    const domain = cleanText(brandMap.domain);

    if (!brandName || !domain) {
      updateExportJobProgress(
        input.jobId,
        { processedBrands: brandIndex + 1 },
        `Skipping incomplete brand ${brandIndex + 1}/${brandMaps.length}...`
      );
      continue;
    }

    updateExportJobProgress(
      input.jobId,
      { processedBrands: brandIndex, processedContacts },
      `Preparing ${brandName} (${brandIndex + 1}/${brandMaps.length})...`
    );

    const allBrandContacts = await ContactModel.find({
      brandName,
      domain,
      email: { $exists: true, $nin: ["", null] },
      status: { $nin: ["invalid", "bounced", "skipped"] },
      verificationStatus: { $nin: ["Invalid", "invalid", "bounced", "Disposable", "disposable"] }
    }).sort({ createdAt: 1 });

    const contacts = selectTopContacts(
      allBrandContacts,
      settings.maxEmailsPerBrand
    );

    const productName = getProductNameFromBrandMap(brandMap);

    for (const contact of contacts as any[]) {
      const email = cleanEmail(contact.email);

      if (!email) continue;

      processedContacts += 1;

      if (
        !cleanText(contact.fullName) ||
        !cleanText(contact.designation || contact.role)
      ) {
        contactsNormalized += 1;
      }

      const verificationStatus = normalizeVerificationStatusForStorage(
        contact.verificationStatus || contact.status || "Pending Verification"
      );

      if (isVerificationRejected(verificationStatus)) {
        skippedInvalidVerification += 1;
        continue;
      }

      const firstName = getBetterFirstName(contact, brandName);

      for (const channel of ["Enoylity Technology", "MHD Tech"] as const) {
        const key = `${channel}::${email}`;

        if (processedChannelEmails.has(key)) continue;
        processedChannelEmails.add(key);

        const cfg = getChannelConfig(channel);

        const upsertResult = await safeUpsertInstantlyLead({
          channel,
          firstName,
          email,
          companyName: brandName,
          productName,
          relatedVideo: cfg.relatedVideo,
          competitor1: "",
          competitor2: "",
          pushedStatus: "",
          verificationStatus,
          instantlyBounced: "",
          gatewayBounced: "Not Checked",
          foundVia: cleanText(brandMap.foundVia || brandMap.seedBrandName),
          pgaScore:
            typeof brandMap.pgaScore === "number" ? brandMap.pgaScore : null,
          brandMapId: brandMap._id,
          contactId: contact._id,
          raw: {
            source: "exportInstantlyLeads",
            oldGasEquivalent: "exportToInstantly",
            exportedWithoutVerification: true
          }
        });

        if (upsertResult.skipped) {
          skippedAlreadyExported += 1;
          continue;
        }

        if (upsertResult.created) exported += 1;
        if (upsertResult.updated) updatedExistingUnpushed += 1;
      }

      if (processedContacts % 100 === 0) {
        updateExportJobProgress(input.jobId, {
          processedContacts,
          newRows: exported,
          updatedExistingUnpushed,
          skippedAlreadyPushed: skippedAlreadyExported,
          verifiedContacts: 0,
          skippedInvalidVerification
        });
      }
    }

    updateExportJobProgress(input.jobId, {
      processedBrands: brandIndex + 1,
      processedContacts,
      newRows: exported,
      updatedExistingUnpushed,
      skippedAlreadyPushed: skippedAlreadyExported,
      verifiedContacts: 0,
      skippedInvalidVerification
    });
  }

  return {
    success: true,
    exported,
    exportedRows: exported,
    skippedAlreadyExported,
    skippedPushedLeads: skippedAlreadyExported,
    updatedExistingUnpushed,
    contactsNormalized,
    contactsFixed: contactsNormalized,
    processedContacts,
    verifiedContacts: 0,
    skippedInvalidVerification,
    competitorsCompanies: 0,
    competitorsUpdated: 0,
    competitorsFailed: 0,
    competitorsStillEmpty: 0,
    pendingVerificationScanned: 0,
    pendingVerified: 0,
    pendingRejected: 0,
    pendingVerificationFailed: 0,
    pendingVerificationRemaining: 0,
    bouncedCampaignsScanned: 0,
    bouncedEmailsFound: 0,
    bouncedRowsUpdated: 0,
    backendMaintenanceErrors: [],
    verifyOnExport: false,
    exportMode: "clean-leads-only"
  };
}

export async function exportInstantlyLeads(req: Request, res: Response) {
  try {
    const result = await runInstantlyExportNow({
      brandName: cleanText(req.body?.brandName)
    });

    const { success: _resultSuccess, ...resultWithoutSuccess } = result;

    return res.json({
      success: true,
      status: "completed",
      message: "Export complete. Clean Instantly leads are prepared.",
      result: resultWithoutSuccess,
      ...resultWithoutSuccess
    });
  } catch (error: any) {
    console.error("[Instantly Export Failed]", error);

    return res.status(500).json({
      success: false,
      status: "failed",
      message: error.message || "Export failed.",
      error: error.message || String(error)
    });
  }
}

export async function getInstantlyExportStatus(req: Request, res: Response) {
  markTimedOutExportJobs();

  const jobId = String(req.params.jobId || "");
  const job = instantlyExportJobs[jobId];

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Export job not found."
    });
  }

  return res.json({
    success: true,
    jobId,
    ...job
  });
}

export async function getTemplates(req: Request, res: Response) {
  try {
    await ensureTemplates();

    const filter: Record<string, any> = {};
    const channel = cleanText(req.query.channel);
    const type = cleanText(req.query.type || req.query.templateType);

    if (channel) filter.channel = channel;
    if (type) filter.templateType = normalizeTemplateType(type);

    const rows = await InstantlyTemplateModel.find(filter).sort({
      channel: 1,
      templateType: 1,
      name: 1
    });

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
    const templateType = normalizeTemplateType(req.body?.templateType);
    const templateId = cleanText(req.body?.templateId);
    const name = cleanText(req.body?.name) || "Default";

    if (!channel) {
      return res.status(400).json({
        success: false,
        message: "Channel is required"
      });
    }

    // Editing an existing template by id (also supports renaming it).
    if (templateId && /^[a-f0-9]{24}$/i.test(templateId)) {
      const duplicate = await InstantlyTemplateModel.findOne({
        _id: { $ne: templateId },
        channel,
        templateType,
        name
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message:
            'A template named "' + name + '" already exists for this channel.'
        });
      }

      const row = await InstantlyTemplateModel.findOneAndUpdate(
        { _id: templateId },
        {
          $set: { name, subject, body, followUp1, followUp2 }
        },
        { returnDocument: "after" }
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Template not found. Refresh and try again."
        });
      }

      return res.json({ success: true, data: row });
    }

    // Creating (or upserting by name) a named template.
    const row = await InstantlyTemplateModel.findOneAndUpdate(
      { channel, templateType, name },
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
        returnDocument: "after"
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

export async function deleteTemplate(req: Request, res: Response) {
  try {
    const templateId = cleanText(req.params.id);

    if (!/^[a-f0-9]{24}$/i.test(templateId)) {
      return res.status(400).json({
        success: false,
        message: "Valid template id is required"
      });
    }

    const row = await InstantlyTemplateModel.findById(templateId);

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    const siblings = await InstantlyTemplateModel.countDocuments({
      channel: row.channel,
      templateType: row.templateType
    });

    if (siblings <= 1) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete the last " +
          row.templateType +
          " template for " +
          row.channel +
          ". Create another template first."
      });
    }

    await InstantlyTemplateModel.deleteOne({ _id: templateId });

    res.json({
      success: true,
      message: 'Template "' + (row.name || "Default") + '" deleted.'
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
    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 5000)
        : 2000;

    const rows = await InstantlyLeadModel.find({ channel })
      .sort({ createdAt: -1 })
      .limit(limit);


    const data = rows.map((row: any) => {
      const lead = row.toObject ? row.toObject() : row;

      return {
        ...lead,
        verificationStatus: getVerificationStatusForResponse(lead),
        instantlyBounced: getInstantlyBouncedStatusForResponse(lead)
      };
    });

    const total = await InstantlyLeadModel.countDocuments({ channel });

    res.json({
      success: true,
      count: data.length,
      total,
      data,
      leads: data
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
    const templateType = normalizeTemplateType(req.query.type);

    const cfg = getChannelConfig(channel);
    const senderEmail = cfg.senders[0] || cfg.allSenders?.[0] || "";

    const template = await resolveTemplateForPush({
      channel,
      templateType,
      templateId: cleanText(req.query.templateId),
      templateName: cleanText(req.query.templateName)
    });

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

export async function verifyPendingInstantlyLeads(req: Request, res: Response) {
  try {
    const channel = cleanText(req.body?.channel || req.query.channel);
    const requestedLimit = Number(req.body?.limit || req.query.limit || 500);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 1000))
      : 500;

    const result = await verifyPendingInstantlyLeadsInternal({ channel, limit });

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify pending leads"
    });
  }
}

export async function fillCompetitors(req: Request, res: Response) {
  try {
    const companyFilter = cleanText(req.body?.companyName || req.query.companyName);
    const channel = cleanText(req.body?.channel || req.query.channel);

    if (companyFilter) {
      const result = await fillCompetitorsForCompanies([companyFilter]);

      return res.json({
        success: true,
        companies: result.companies,
        updated: result.updated,
        failed: result.failed,
        stillEmpty: result.stillEmpty,
        data: result.data
      });
    }

    const result = await fillMissingCompetitorsInternal({ channel });

    res.json({
      success: true,
      companies: result.companies,
      updated: result.updated,
      failed: result.failed,
      stillEmpty: result.stillEmpty,
      data: result.data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fill competitors"
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
      selectedSenders,
      niche: cleanText(req.body.niche),
      templateType: req.body.templateType,
      templateId: cleanText(req.body.templateId),
      templateName: cleanText(req.body.templateName)
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
    const niche = cleanText(req.body.niche);

    let createdCampaigns = 0;
    let totalPushed = 0;
    const results: any[] = [];

    for (const date of dates) {
      const dateStr = formatCampaignDate(date);
      const dayLabel = formatDayLabel(date);
      const campaignName = niche
        ? dayLabel + " - " + niche + " (" + cfg.brandShort + ")"
        : dayLabel + " (" + cfg.brandShort + ")";

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
        usedEmails,
        niche,
        templateType: req.body.templateType,
        templateId: cleanText(req.body.templateId),
        templateName: cleanText(req.body.templateName)
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
    const channel = cleanText(req.query.channel);
    const filter: Record<string, any> = {};

    if (channel) {
      filter.channel = channel;
    }

    // raw carries the full Instantly create payload (template HTML etc.) —
    // never rendered on the campaigns list.
    const rows = await InstantlyCampaignModel.find(filter)
      .select("-raw")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    // One aggregate enriches every card with live lead counts.
    const campaignIds = rows
      .map((row: any) => cleanText(row.instantlyCampaignId))
      .filter(Boolean);

    const statsByCampaign: Record<string, any> = {};

    if (campaignIds.length > 0) {
      const agg = await InstantlyLeadModel.aggregate([
        { $match: { campaignId: { $in: campaignIds } } },
        {
          $group: {
            _id: "$campaignId",
            total: { $sum: 1 },
            bounced: {
              $sum: {
                $cond: [
                  { $in: ["$instantlyBounced", ["", null, "Not bounced"]] },
                  0,
                  1
                ]
              }
            },
            verified: {
              $sum: { $cond: [{ $eq: ["$verificationStatus", "Ok"] }, 1, 0] }
            }
          }
        }
      ]);

      for (const item of agg) {
        statsByCampaign[String(item._id)] = {
          leadsInCampaign: item.total,
          bouncedCount: item.bounced,
          verifiedCount: item.verified
        };
      }
    }

    const now = Date.now();

    const data = rows.map((row: any) => {
      const stats = statsByCampaign[cleanText(row.instantlyCampaignId)] || {
        leadsInCampaign: 0,
        bouncedCount: 0,
        verifiedCount: 0
      };

      const endTime = row.endDate ? new Date(row.endDate).getTime() : 0;
      const derivedStatus =
        endTime && endTime < now ? "Completed" : row.status || "Active";

      return { ...row, ...stats, derivedStatus };
    });

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getInstantlyCampaignLeads(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign id"
      });
    }

    const campaign: any = await InstantlyCampaignModel.findById(id).lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found"
      });
    }

    const leads = await InstantlyLeadModel.find({
      channel: campaign.channel,
      campaignId: campaign.instantlyCampaignId
    })
      .select("-raw -releaseHistory")
      .sort({ pushedAt: -1, createdAt: -1 })
      .lean();

    const data = leads.map((lead: any) => ({
      ...lead,
      instantlyBounced: getInstantlyBouncedStatusForResponse(lead),
      verificationStatus: getVerificationStatusForResponse(lead)
    }));

    res.json({
      success: true,
      campaign,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function buildPushConfig(body: any) {
  return {
    channel: cleanText(body.channel),
    campaignName: cleanText(body.campaignName),
    startDate: cleanText(body.startDate),
    endDate: cleanText(body.endDate) || cleanText(body.startDate),
    startTime:
      cleanText(body.startTime) ||
      process.env.INSTANTLY_DEFAULT_START_TIME ||
      "09:00",
    endTime:
      cleanText(body.endTime) ||
      process.env.INSTANTLY_DEFAULT_END_TIME ||
      "16:00",
    dailyLimit: Number(
      body.dailyLimit || process.env.INSTANTLY_DEFAULT_DAILY_LIMIT || 160
    ),
    selectedSenders: Array.isArray(body.selectedSenders)
      ? body.selectedSenders
      : [],
    templateType: normalizeTemplateType(body.templateType),
    templateId: cleanText(body.templateId),
    templateName: cleanText(body.templateName),
    leadIds: Array.isArray(body.leadIds)
      ? body.leadIds.map((id: any) => String(id))
      : []
  };
}

// Preview a campaign built from explicitly selected leads: runs the real
// eligibility checks (which persist verification/gateway hygiene) and returns
// the exact payload + per-lead variables the push would send.
export async function previewSelectedCampaign(req: Request, res: Response) {
  try {
    const cfg = buildPushConfig(req.body);

    if (!cfg.channel || cfg.leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "channel and leadIds are required"
      });
    }

    const { leadsToPush, leadIds, rejected } = await getEligibleLeadsByIds({
      channel: cfg.channel,
      leadIds: cfg.leadIds
    });

    let nameConflict = false;

    if (cleanText(cfg.campaignName)) {
      const searchResult = await instantlyApiCall(
        "GET",
        "/campaigns?search=" +
          encodeURIComponent(cfg.campaignName) +
          "&limit=100"
      );
      const existing = Array.isArray(searchResult?.items)
        ? searchResult.items
        : Array.isArray(searchResult)
          ? searchResult
          : [];
      nameConflict = existing.some((c: any) => c.name === cfg.campaignName);
    }

    await ensureTemplates();
    const template = await resolveTemplateForPush({
      channel: cfg.channel,
      templateType: cfg.templateType,
      templateId: cfg.templateId,
      templateName: cfg.templateName
    });

    const payload = template
      ? buildCampaignPayload({ ...cfg, template })
      : null;

    res.json({
      success: true,
      nameConflict,
      templateType: cfg.templateType,
      templateName: template ? cleanText(template.name) || "Default" : "",
      eligibleCount: leadsToPush.length,
      rejected,
      leadIds: leadIds.map((id: any) => String(id)),
      payloadSummary: payload
        ? {
            name: payload.name,
            email_list: payload.email_list,
            daily_limit: payload.daily_limit,
            campaign_schedule: payload.campaign_schedule
          }
        : null,
      leads: leadsToPush.map((lead: any) => ({
        _id: String(lead._id),
        firstName: lead.firstName,
        email: lead.email,
        companyName: lead.companyName,
        productName: lead.productName,
        relatedVideo: lead.relatedVideo,
        competitor1: lead.competitor1,
        competitor2: lead.competitor2,
        foundVia: lead.foundVia,
        pgaScore: lead.pgaScore
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Push a campaign built from explicitly selected leads.
export async function pushSelectedCampaign(req: Request, res: Response) {
  try {
    const cfg = buildPushConfig(req.body);

    if (
      !cfg.channel ||
      !cfg.campaignName ||
      cfg.leadIds.length === 0 ||
      !cfg.startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "channel, campaignName, startDate and leadIds are required"
      });
    }

    const { leadsToPush, leadIds, rejected } = await getEligibleLeadsByIds({
      channel: cfg.channel,
      leadIds: cfg.leadIds
    });

    if (leadsToPush.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No eligible leads after verification and gateway checks.",
        rejected
      });
    }

    const result = await createAndPushCampaign({
      channel: cfg.channel,
      campaignName: cfg.campaignName,
      numLeads: leadsToPush.length,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      startTime: cfg.startTime,
      endTime: cfg.endTime,
      dailyLimit: cfg.dailyLimit,
      selectedSenders: cfg.selectedSenders,
      templateType: cfg.templateType,
      templateId: cfg.templateId,
      templateName: cfg.templateName,
      explicitLeads: { leadsToPush, leadIds }
    });

    res.json({
      success: true,
      rejected,
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

    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPushLogs(req: Request, res: Response) {
  try {
    const rows = await PushLogModel.find({})
      .select("-raw")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

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
    const mode = req.body?.mode === "crm" ? "crm" : "all";
    const result = await pullBouncedFromInstantlyInternal(mode);

    res.json({
      success: true,
      ...result
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
    const expectedSecret = String(
      process.env.INSTANTLY_WEBHOOK_SECRET || ""
    ).trim();

    if (!expectedSecret) {
      return res.status(503).json({
        success: false,
        message: "INSTANTLY_WEBHOOK_SECRET is not configured."
      });
    }

    const providedSecret = String(
      req.query?.secret || req.headers["x-webhook-secret"] || ""
    ).trim();

    if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook secret."
      });
    }

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
            instantlyBounced: "Bounced",
            "raw.instantlyBounced": "Bounced",
            "raw.instantlyBouncedAt": new Date()
          }
        }
      );

      await ContactModel.updateMany(
        { email },
        {
          $set: {
            "raw.instantlyBounced": "Bounced",
            "raw.instantlyBouncedAt": new Date()
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

// Manual unpush: clear the pushed marker on explicitly selected leads so they
// can enter a new campaign immediately (no cooling-off wait — this is a
// deliberate per-lead action, unlike the bulk time-based release below).
// Bounced leads stay locked; the old Instantly campaign is not modified.
export async function unpushLeads(req: Request, res: Response) {
  try {
    const channel = cleanText(req.body?.channel);
    const leadIds: string[] = (
      Array.isArray(req.body?.leadIds) ? req.body.leadIds : []
    )
      .map((id: any) => String(id))
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    if (!channel || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "channel and leadIds are required"
      });
    }

    if (leadIds.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Too many leads in one request (max 500)."
      });
    }

    const rows = await InstantlyLeadModel.find({
      _id: { $in: leadIds.map((id) => new mongoose.Types.ObjectId(id)) },
      channel,
      pushedStatus: { $nin: ["", null] }
    })
      .select("email companyName pushedStatus pushedAt campaignId campaignName instantlyBounced")
      .lean();

    const unpushable = (rows as any[]).filter(
      (row) => ["", null].includes(row.instantlyBounced) ||
        cleanText(row.instantlyBounced).toLowerCase() === "not bounced"
    );
    const skippedBounced = rows.length - unpushable.length;

    if (unpushable.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          rows.length === 0
            ? "None of the selected leads are pushed."
            : "All selected pushed leads are bounced — bounced leads stay locked.",
        skippedBounced
      });
    }

    const releasedAt = new Date();
    const releasedBy = String((req as any).user?.email || "");

    await InstantlyLeadModel.bulkWrite(
      unpushable.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $push: {
              releaseHistory: {
                releasedAt,
                releasedBy,
                reason: "manual-unpush",
                previousPushedStatus: row.pushedStatus || "",
                previousCampaignId: row.campaignId || "",
                previousCampaignName: row.campaignName || "",
                previousPushedAt: row.pushedAt || null
              }
            },
            $set: {
              pushedStatus: "",
              campaignId: "",
              campaignName: ""
            },
            $unset: {
              pushedAt: ""
            }
          }
        }
      }))
    );

    // Reset contacts only when no other channel still has the email pushed.
    const emails = Array.from(
      new Set(unpushable.map((row) => cleanEmail(row.email)).filter(Boolean))
    );

    const stillPushed = new Set(
      (
        await InstantlyLeadModel.distinct("email", {
          email: { $in: emails },
          pushedStatus: { $nin: ["", null] }
        })
      ).map((email: any) => cleanEmail(email))
    );

    const resettable = emails.filter((email) => !stillPushed.has(email));

    let contactsReset = 0;

    if (resettable.length > 0) {
      const verifiedResult = await ContactModel.updateMany(
        { email: { $in: resettable }, status: "pushed", verificationStatus: "Ok" },
        { $set: { status: "verified" }, $unset: { pushedAt: "" } }
      );
      const restResult = await ContactModel.updateMany(
        { email: { $in: resettable }, status: "pushed" },
        { $set: { status: "email_found" }, $unset: { pushedAt: "" } }
      );

      contactsReset =
        Number(verifiedResult?.modifiedCount || 0) +
        Number(restResult?.modifiedCount || 0);
    }

    res.json({
      success: true,
      unpushed: unpushable.length,
      skippedBounced,
      contactsReset
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Cooling-off: release leads pushed long enough ago so their brands can be
// re-pitched. Defaults to a dry run; the cutoff can never be younger than
// the coolingOffMonths setting. Bounced leads stay locked forever.
export async function releasePushedLeads(req: Request, res: Response) {
  try {
    const settings = await getAppSettings();

    const dryRun = req.body?.dryRun !== false;
    const channel = cleanText(req.body?.channel);
    const month = cleanText(req.body?.month);

    const requestedMonths = Number(req.body?.olderThanMonths);
    const effectiveMonths = Math.max(
      Number.isFinite(requestedMonths) && requestedMonths > 0
        ? Math.round(requestedMonths)
        : settings.coolingOffMonths,
      settings.coolingOffMonths
    );

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - effectiveMonths);

    const query: Record<string, any> = {
      pushedStatus: { $nin: ["", null] },
      pushedAt: { $lte: cutoff },
      instantlyBounced: { $in: ["", null] }
    };

    if (channel) {
      query.channel = channel;
    }

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: "month must look like 2026-03"
        });
      }

      const [year, monthNumber] = month.split("-").map(Number);
      const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
      const monthEnd = new Date(Date.UTC(year, monthNumber, 1));

      query.pushedAt = {
        $gte: monthStart,
        $lt: monthEnd < cutoff ? monthEnd : cutoff,
        $lte: cutoff
      };
    }

    // Rows never backfilled with pushedAt are invisible to this query;
    // surface the count so the operator knows to run the backfill script.
    const missingPushedAt = await InstantlyLeadModel.countDocuments({
      pushedStatus: { $nin: ["", null] },
      $or: [{ pushedAt: { $exists: false } }, { pushedAt: null }],
      ...(channel ? { channel } : {})
    });

    const rows = await InstantlyLeadModel.find(query)
      .select("email companyName channel pushedStatus pushedAt campaignId campaignName")
      .lean();

    const byCompany: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    for (const row of rows as any[]) {
      const company = cleanText(row.companyName) || "(unknown)";
      byCompany[company] = (byCompany[company] || 0) + 1;

      const monthKey = row.pushedAt
        ? new Date(row.pushedAt).toISOString().substring(0, 7)
        : "(unknown)";
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    }

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        eligible: rows.length,
        cutoff,
        effectiveMonths,
        missingPushedAt,
        byMonth,
        byCompany
      });
    }

    if (rows.length === 0) {
      return res.json({
        success: true,
        dryRun: false,
        released: 0,
        contactsReset: 0,
        cutoff,
        effectiveMonths,
        missingPushedAt
      });
    }

    const releasedAt = new Date();

    await InstantlyLeadModel.bulkWrite(
      (rows as any[]).map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $push: {
              releaseHistory: {
                releasedAt,
                releasedBy: String((req as any).user?.email || ""),
                previousPushedStatus: row.pushedStatus || "",
                previousCampaignId: row.campaignId || "",
                previousCampaignName: row.campaignName || "",
                previousPushedAt: row.pushedAt || null
              }
            },
            $set: {
              pushedStatus: "",
              campaignId: "",
              campaignName: ""
            },
            $unset: {
              pushedAt: ""
            }
          }
        }
      }))
    );

    // Only reset contacts whose email has no remaining pushed lead on any
    // channel (the other channel may still have an active campaign).
    const releasedEmails = Array.from(
      new Set(
        (rows as any[]).map((row) => cleanEmail(row.email)).filter(Boolean)
      )
    );

    const stillPushed = new Set(
      (
        await InstantlyLeadModel.distinct("email", {
          email: { $in: releasedEmails },
          pushedStatus: { $nin: ["", null] }
        })
      ).map((email: any) => cleanEmail(email))
    );

    const resettableEmails = releasedEmails.filter(
      (email) => !stillPushed.has(email)
    );

    let contactsReset = 0;

    if (resettableEmails.length > 0) {
      const verifiedResult = await ContactModel.updateMany(
        {
          email: { $in: resettableEmails },
          status: "pushed",
          verificationStatus: "Ok"
        },
        {
          $set: { status: "verified" },
          $unset: { pushedAt: "" }
        }
      );

      const restResult = await ContactModel.updateMany(
        {
          email: { $in: resettableEmails },
          status: "pushed"
        },
        {
          $set: { status: "email_found" },
          $unset: { pushedAt: "" }
        }
      );

      contactsReset =
        Number(verifiedResult?.modifiedCount || 0) +
        Number(restResult?.modifiedCount || 0);
    }

    res.json({
      success: true,
      dryRun: false,
      released: rows.length,
      contactsReset,
      cutoff,
      effectiveMonths,
      missingPushedAt,
      byMonth,
      byCompany
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Asset/code files a CSV export can carry as fake emails (same guard the
// worker applies to scraped emails, e.g. "swiper@12.min.css").
const IMPORT_ASSET_EMAIL_REGEX =
  /(\.(css|js|mjs|cjs|ts|json|map|scss|less|png|jpe?g|svg|webp|gif|woff2?|ttf|otf|eot|ico|mp4|webm|mp3|wav|pdf|xml|yml|yaml)$)|(@\d+(\.\d+)*\.)|(\.min\.)/i;

function isValidImportEmail(email: string) {
  if (!email) return false;

  const lower = email.toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return false;
  if (IMPORT_ASSET_EMAIL_REGEX.test(lower)) return false;

  const tld = lower.split(".").pop() || "";

  return /^[a-z]{2,}$/.test(tld);
}

// CSV import of inbound leads. Rows land as normal unpushed InstantlyLead
// rows (foundVia "CSV Import"), so the existing campaign flow — select →
// Create Campaign → preview → push with all safety checks — works on them
// unchanged. Emails already bounced on any channel carry the bounce flags
// over so push-time validation keeps rejecting them.
export async function importInboundLeads(req: Request, res: Response) {
  try {
    const channel = cleanText(req.body?.channel);
    const inputRows: any[] = Array.isArray(req.body?.leads)
      ? req.body.leads
      : [];

    if (!["Enoylity Technology", "MHD Tech"].includes(channel)) {
      return res.status(400).json({
        success: false,
        message: "channel must be Enoylity Technology or MHD Tech"
      });
    }

    if (inputRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "leads is required"
      });
    }

    if (inputRows.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Too many leads in one request (max 500 per batch)."
      });
    }

    const cfg = getChannelConfig(channel);
    const importedBy = String((req as any).user?.email || "");
    const importedAt = new Date();

    const invalidSamples: Array<{ email: string; reason: string }> = [];
    let invalid = 0;
    let duplicates = 0;

    const seen = new Set<string>();
    const candidates: any[] = [];

    for (const row of inputRows) {
      const email = cleanEmail(row?.email);

      if (!isValidImportEmail(email)) {
        invalid += 1;
        if (invalidSamples.length < 10) {
          invalidSamples.push({
            email: cleanText(row?.email) || "(empty)",
            reason: "Invalid email address"
          });
        }
        continue;
      }

      if (seen.has(email)) {
        duplicates += 1;
        continue;
      }
      seen.add(email);

      const companyName = cleanText(row?.companyName);

      candidates.push({
        channel,
        email,
        firstName: cleanText(row?.firstName),
        companyName,
        productName:
          cleanText(row?.productName) ||
          (companyName ? `${companyName} products` : ""),
        relatedVideo: cfg.relatedVideo,
        competitor1: "",
        competitor2: "",
        pushedStatus: "",
        verificationStatus: "",
        instantlyBounced: "",
        gatewayBounced: "Not Checked",
        foundVia: "CSV Import",
        pgaScore: null,
        campaignName: "",
        raw: {
          source: "csv-import",
          importedBy,
          importedAt,
          website: cleanText(row?.website),
          niche: cleanText(row?.niche)
        }
      });
    }

    if (candidates.length === 0) {
      return res.json({
        success: true,
        inserted: 0,
        duplicates,
        invalid,
        invalidSamples,
        total: inputRows.length
      });
    }

    const candidateEmails = candidates.map((c) => c.email);

    // Existing rows on this channel: CSV-imported unpushed rows get their
    // fields refreshed from the new file (so re-uploading a corrected CSV
    // fixes names); crawled or already-pushed rows are never overwritten.
    const existing = await (InstantlyLead as any)
      .find(
        { channel, email: { $in: candidateEmails } },
        {
          email: 1,
          firstName: 1,
          companyName: 1,
          productName: 1,
          pushedStatus: 1,
          foundVia: 1
        }
      )
      .lean();
    const existingByEmail = new Map<string, any>(
      (existing as any[]).map((r) => [cleanEmail(r.email), r])
    );

    // Bounce carry-over from any channel, so a known-bad address cannot
    // re-enter as a fresh clean row.
    const bouncedSiblings = await (InstantlyLead as any)
      .find(
        { email: { $in: candidateEmails } },
        { email: 1, instantlyBounced: 1, gatewayBounced: 1 }
      )
      .lean();
    const bounceByEmail = new Map<string, any>();

    for (const sibling of bouncedSiblings as any[]) {
      if (
        isBounceRejected(sibling.instantlyBounced) ||
        isBounceRejected(sibling.gatewayBounced)
      ) {
        bounceByEmail.set(cleanEmail(sibling.email), sibling);
      }
    }

    const toLeadRef = (row: any) => ({
      _id: String(row._id),
      firstName: cleanText(row.firstName),
      email: cleanEmail(row.email),
      companyName: cleanText(row.companyName),
      productName: cleanText(row.productName)
    });

    const docs: any[] = [];
    const refreshOps: any[] = [];
    const refreshedRefs: any[] = [];
    const duplicateRefs: any[] = [];
    let updated = 0;

    for (const c of candidates) {
      const existingRow = existingByEmail.get(c.email);

      if (existingRow) {
        const isPushed = Boolean(cleanText(existingRow.pushedStatus));
        const isCsvRow = cleanText(existingRow.foundVia) === "CSV Import";

        if (!isPushed && isCsvRow) {
          const set: any = {
            "raw.reimportedAt": importedAt,
            "raw.reimportedBy": importedBy
          };

          if (c.firstName) set.firstName = c.firstName;
          if (c.companyName) set.companyName = c.companyName;
          if (c.productName) set.productName = c.productName;
          if (c.raw.website) set["raw.website"] = c.raw.website;
          if (c.raw.niche) set["raw.niche"] = c.raw.niche;

          refreshOps.push({
            updateOne: { filter: { _id: existingRow._id }, update: { $set: set } }
          });
          refreshedRefs.push({
            _id: String(existingRow._id),
            firstName: c.firstName || cleanText(existingRow.firstName),
            email: c.email,
            companyName: c.companyName || cleanText(existingRow.companyName),
            productName: c.productName || cleanText(existingRow.productName)
          });
          updated += 1;
        } else {
          duplicates += 1;
          duplicateRefs.push(toLeadRef(existingRow));
        }

        continue;
      }

      const bounced = bounceByEmail.get(c.email);

      if (!bounced) {
        docs.push(c);
        continue;
      }

      docs.push({
        ...c,
        instantlyBounced: cleanText(bounced.instantlyBounced) || "",
        gatewayBounced: cleanText(bounced.gatewayBounced) || "Not Checked"
      });
    }

    if (refreshOps.length > 0) {
      await (InstantlyLead as any).bulkWrite(refreshOps, { ordered: false });
    }

    let inserted = 0;
    let insertedDocs: any[] = [];

    if (docs.length > 0) {
      try {
        insertedDocs = await (InstantlyLead as any).insertMany(docs, {
          ordered: false
        });
        inserted = insertedDocs.length;
      } catch (error: any) {
        // ordered:false inserts what it can; duplicates that raced in
        // between our check and the insert surface here as write errors.
        insertedDocs = Array.isArray(error?.insertedDocs)
          ? error.insertedDocs
          : [];
        inserted = insertedDocs.length;
        duplicates += docs.length - inserted;
      }
    }

    // Every lead from this file that now exists on the channel (new,
    // refreshed and pre-existing), so the UI can jump straight into
    // campaign creation.
    res.json({
      success: true,
      inserted,
      updated,
      duplicates,
      invalid,
      invalidSamples,
      total: inputRows.length,
      leads: [
        ...insertedDocs.map(toLeadRef),
        ...refreshedRefs,
        ...duplicateRefs
      ]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
