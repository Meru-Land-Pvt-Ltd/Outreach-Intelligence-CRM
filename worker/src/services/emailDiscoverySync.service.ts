import { EmailDiscovery } from "../models/EmailDiscovery.model";

function cleanDomain(domain: string) {
  return String(domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export async function syncBrandMapToEmailDiscovery(input: {
  brandName: string;
  domain: string;
  foundVia?: string;
  seedBrandId?: string;
  brandMapId?: any;
}) {
  const brandName = String(input.brandName || "").trim();
  const domain = cleanDomain(input.domain);

  if (!brandName || !domain || domain === "n/a") {
    return null;
  }

  return EmailDiscovery.findOneAndUpdate(
    {
      brandName,
      domain
    },
    {
      $setOnInsert: {
        seedBrandId: input.seedBrandId,
        brandMapId: input.brandMapId,
        brandName,
        domain,
        foundVia: input.foundVia || "",
        instagram: "",
        twitter: "",
        facebook: "",
        linkedin: "",
        youtube: "",
        website: "",
        totalEmails: "",
        hunter: "",
        apollo: "",
        prospeo: "",
        status: "synced"
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}
