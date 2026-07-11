import mongoose from "mongoose";
import dotenv from "dotenv";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { BrandMap } from "../models/BrandMap.model";
import { InstantlyCampaign } from "../models/InstantlyCampaign.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

function cleanValue(value: any) {
  return String(value || "").trim();
}

// Parse the campaign name out of "Pushed YYYY-MM-DD HH:MM - <name>".
function campaignFromPushedStatus(pushedStatus: any) {
  const match = String(pushedStatus || "").match(/Pushed [^-]+ - (.+)$/);
  return match ? match[1].trim() : "";
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const leads = InstantlyLead as any;
  const brandMaps = BrandMap as any;
  const campaigns = InstantlyCampaign as any;

  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");

  // 1) foundVia + pgaScore from the linked BrandMap (by id, else by company).
  const brandMapById = new Map<string, any>();
  const brandMapByName = new Map<string, any>();

  for (const row of await brandMaps
    .find({}, { brandName: 1, foundVia: 1, seedBrandName: 1, pgaScore: 1 })
    .lean()) {
    brandMapById.set(String(row._id), row);

    const name = cleanValue(row.brandName).toLowerCase();
    if (name && !brandMapByName.has(name)) {
      brandMapByName.set(name, row);
    }
  }

  const needFoundVia = await leads
    .find(
      { $or: [{ foundVia: { $exists: false } }, { foundVia: { $in: ["", null] } }] },
      { companyName: 1, brandMapId: 1 }
    )
    .lean();

  console.log("Leads missing foundVia:", needFoundVia.length);

  let foundViaSet = 0;

  for (const lead of needFoundVia as any[]) {
    const source =
      (lead.brandMapId && brandMapById.get(String(lead.brandMapId))) ||
      brandMapByName.get(cleanValue(lead.companyName).toLowerCase());

    if (!source) continue;

    const foundVia = cleanValue(source.foundVia || source.seedBrandName);
    const pgaScore =
      typeof source.pgaScore === "number" ? source.pgaScore : null;

    if (!foundVia && pgaScore === null) continue;

    foundViaSet += 1;

    if (!dryRun) {
      const update: any = {};
      if (foundVia) update.foundVia = foundVia;
      if (pgaScore !== null) update.pgaScore = pgaScore;

      await leads.updateOne({ _id: lead._id }, { $set: update });
    }
  }

  console.log("Leads updated with foundVia/pgaScore:", foundViaSet);

  // 2) campaignName from campaignId → InstantlyCampaign, else pushedStatus.
  const campaignNameById = new Map<string, string>();

  for (const campaign of await campaigns
    .find({}, { instantlyCampaignId: 1, campaignName: 1 })
    .lean()) {
    const id = cleanValue(campaign.instantlyCampaignId);
    if (id) campaignNameById.set(id, cleanValue(campaign.campaignName));
  }

  const needCampaignName = await leads
    .find(
      {
        pushedStatus: { $nin: ["", null] },
        $or: [
          { campaignName: { $exists: false } },
          { campaignName: { $in: ["", null] } }
        ]
      },
      { campaignId: 1, pushedStatus: 1 }
    )
    .lean();

  console.log("Pushed leads missing campaignName:", needCampaignName.length);

  let campaignNameSet = 0;

  for (const lead of needCampaignName as any[]) {
    const campaignName =
      campaignNameById.get(cleanValue(lead.campaignId)) ||
      campaignFromPushedStatus(lead.pushedStatus);

    if (!campaignName) continue;

    campaignNameSet += 1;

    if (!dryRun) {
      await leads.updateOne(
        { _id: lead._id },
        { $set: { campaignName } }
      );
    }
  }

  console.log("Leads updated with campaignName:", campaignNameSet);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
