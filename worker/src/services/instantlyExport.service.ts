import { Contact } from "../models/Contact.model";
import { BrandMap } from "../models/BrandMap.model";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { getAppSettings } from "./appSettings.service";

const ContactModel = Contact as any;
const BrandMapModel = BrandMap as any;
const InstantlyLeadModel = InstantlyLead as any;

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
export function selectTopContacts(contacts: any[], cap: number) {
  if (!Number.isFinite(cap) || cap <= 0 || contacts.length <= cap) {
    return contacts;
  }

  const scored = contacts.map((contact: any, index: number) => {
    const email = cleanEmail(contact.email);
    const roleText =
      cleanText(contact.designation || contact.role) +
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
      cleanText(contact.verificationStatus) === "Ok" ||
      cleanText(contact.status) === "verified"
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

const ENOYLITY_RELATED_FALLBACK =
  "https://www.youtube.com/watch?v=epYZxWOC_KE&list=PL4Bx6jiikXaWgZvxXTDvM3WNwClh690-E&index=1";

const MHD_RELATED_FALLBACK =
  "https://www.youtube.com/watch?v=7oHoSLZwuFo&list=PL8qd4kKWDLTuRVZ2qejyv8sVW2OTC93or&index=1";

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return String(value || "").trim().toLowerCase();
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

function getFirstName(contact: any, brandName: string) {
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

function relatedVideoForChannel(channel: string) {
  if (channel === "Enoylity Technology") {
    return process.env.ENOYLITY_RELATED_FALLBACK || ENOYLITY_RELATED_FALLBACK;
  }

  if (channel === "MHD Tech") {
    return process.env.MHD_RELATED_FALLBACK || MHD_RELATED_FALLBACK;
  }

  return "";
}

function shouldMarkVerificationOk(contact: any) {
  return (
    contact.status === "verified" ||
    contact.verificationStatus === "valid" ||
    contact.verificationStatus === "Ok"
  );
}

async function normalizeContact(contact: any, brandName: string) {
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

  const payload = {
    ...input,
    channel,
    email
  };

  delete payload._id;

  const insertDefaults = {
    pushedStatus: cleanText(input.pushedStatus) || "",
    instantlyBounced: cleanText(input.instantlyBounced) || "",
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

export async function exportBrandToInstantlyTabs(brandName: string) {
  const brandMap = await BrandMapModel.findOne({
    brandName
  }).sort({
    createdAt: -1
  });

  if (!brandMap) {
    return {
      exported: 0,
      updated: 0,
      skippedAlreadyExported: 0,
      contactsNormalized: 0,
      reason: "brand_map_not_found"
    };
  }

  const domain = cleanText(brandMap.domain);

  if (!domain) {
    return {
      exported: 0,
      updated: 0,
      skippedAlreadyExported: 0,
      contactsNormalized: 0,
      reason: "domain_missing"
    };
  }

  const allContacts = await ContactModel.find({
    brandName,
    domain,
    email: {
      $exists: true,
      $nin: ["", null]
    },
    status: {
      $nin: ["invalid", "bounced", "skipped"]
    },
    verificationStatus: {
      $nin: ["invalid", "bounced"]
    }
  }).sort({
    createdAt: 1
  });

  const settings = await getAppSettings();
  const contacts = selectTopContacts(allContacts, settings.maxEmailsPerBrand);

  const productName = getProductNameFromBrandMap(brandMap);

  let exported = 0;
  let updated = 0;
  let skippedAlreadyExported = 0;
  let contactsNormalized = 0;
  const processedChannelEmails = new Set<string>();

  for (const originalContact of contacts as any[]) {
    const email = cleanEmail(originalContact.email);

    if (!email) continue;

    const contact = await normalizeContact(originalContact, brandName);

    if (
      !cleanText(originalContact.fullName) ||
      !cleanText(originalContact.designation || originalContact.role)
    ) {
      contactsNormalized += 1;
    }

    const firstName = getFirstName(contact, brandName);

    for (const channel of ["Enoylity Technology", "MHD Tech"] as const) {
      const key = `${channel}::${email}`;

      if (processedChannelEmails.has(key)) continue;
      processedChannelEmails.add(key);

      const upsertResult = await safeUpsertInstantlyLead({
        channel,
        firstName,
        email,
        companyName: brandName,
        productName,
        relatedVideo: relatedVideoForChannel(channel),
        competitor1: "",
        competitor2: "",
        pushedStatus: "",
        verificationStatus: shouldMarkVerificationOk(contact)
          ? "Ok"
          : "Pending Verification",
        instantlyBounced: "",
        gatewayBounced: "Not Checked",
        brandMapId: brandMap._id,
        contactId: contact._id,
        raw: {
          source: "worker_exportBrandToInstantlyTabs",
          oldGasEquivalent: "exportToInstantly"
        }
      });

      if (upsertResult.skipped) {
        skippedAlreadyExported += 1;
        continue;
      }

      if (upsertResult.created) exported += 1;
      if (upsertResult.updated) updated += 1;
    }
  }

  return {
    exported,
    updated,
    skippedAlreadyExported,
    contactsNormalized
  };
}