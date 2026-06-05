import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contact } from "../models/Contact.model";

dotenv.config();

const ContactModel = Contact as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getLocalPart(email: string) {
  return String(email || "").split("@")[0].toLowerCase();
}

function isGenericEmail(email: string) {
  const local = getLocalPart(email);

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
    return local === word || local.startsWith(word + ".") || local.startsWith(word + "-") || local.startsWith(word + "_");
  });
}

function inferName(email: string, brandName: string) {
  const local = getLocalPart(email);

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

function inferRole(email: string) {
  const local = getLocalPart(email);

  if (local.includes("influencer") || local.includes("kol")) {
    return "Influencer Marketing";
  }

  if (local.includes("affiliate")) {
    return "Affiliate Marketing";
  }

  if (local.includes("contentpartner") || local.includes("partner")) {
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

  if (local.includes("support") || local.includes("service") || local === "cs") {
    return "Support";
  }

  if (local.includes("business")) {
    return "Business";
  }

  return "";
}

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/outreach_intelligence_crm"
  );

  const contacts = await ContactModel.find({
    email: { $exists: true, $nin: ["", null] }
  });

  let updated = 0;

  for (const contact of contacts) {
    const email = cleanText(contact.email).toLowerCase();
    const brandName = cleanText(contact.brandName);

    const currentName = cleanText(contact.fullName);
    const currentRole = cleanText(contact.designation || contact.role);

    const inferredName = currentName ? currentName : inferName(email, brandName);
    const inferredRole = currentRole ? currentRole : inferRole(email);

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

      updated += 1;
    }
  }

  console.log({
    scanned: contacts.length,
    updated
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
