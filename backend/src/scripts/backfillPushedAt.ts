import mongoose from "mongoose";
import dotenv from "dotenv";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { InstantlyCampaign } from "../models/InstantlyCampaign.model";
import { Contact } from "../models/Contact.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

// pushedStatus format: "Pushed YYYY-MM-DD HH:MM - <campaign name>" (UTC).
function parsePushedAtFromStatus(pushedStatus: any) {
  const match = String(pushedStatus || "").match(
    /Pushed (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/
  );

  if (!match) return null;

  const date = new Date(match[1].replace(" ", "T") + ":00.000Z");

  return Number.isNaN(date.getTime()) ? null : date;
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const leads = InstantlyLead as any;
  const campaigns = InstantlyCampaign as any;
  const contacts = Contact as any;

  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");

  // Campaign push times for the campaignId fallback.
  const campaignPushedAt = new Map<string, Date>();

  for (const campaign of await campaigns
    .find({}, { instantlyCampaignId: 1, pushedAt: 1, createdAt: 1 })
    .lean()) {
    const id = String(campaign.instantlyCampaignId || "");
    const date = campaign.pushedAt || campaign.createdAt;

    if (id && date) {
      campaignPushedAt.set(id, new Date(date));
    }
  }

  const rows = await leads
    .find(
      {
        pushedStatus: { $nin: ["", null] },
        $or: [{ pushedAt: { $exists: false } }, { pushedAt: null }]
      },
      { pushedStatus: 1, campaignId: 1, updatedAt: 1, email: 1 }
    )
    .lean();

  console.log("Pushed leads missing pushedAt:", rows.length);

  let fromStatus = 0;
  let fromCampaign = 0;
  let fromUpdatedAt = 0;
  const monthHistogram: Record<string, number> = {};
  const emailPushedAt = new Map<string, Date>();

  for (const row of rows as any[]) {
    let pushedAt = parsePushedAtFromStatus(row.pushedStatus);

    if (pushedAt) {
      fromStatus += 1;
    } else if (row.campaignId && campaignPushedAt.has(String(row.campaignId))) {
      pushedAt = campaignPushedAt.get(String(row.campaignId))!;
      fromCampaign += 1;
    } else if (row.updatedAt) {
      pushedAt = new Date(row.updatedAt);
      fromUpdatedAt += 1;
    }

    if (!pushedAt) continue;

    const monthKey = pushedAt.toISOString().substring(0, 7);
    monthHistogram[monthKey] = (monthHistogram[monthKey] || 0) + 1;

    const email = String(row.email || "").trim().toLowerCase();

    if (email) {
      const existing = emailPushedAt.get(email);

      if (!existing || pushedAt > existing) {
        emailPushedAt.set(email, pushedAt);
      }
    }

    if (!dryRun) {
      await leads.updateOne({ _id: row._id }, { $set: { pushedAt } });
    }
  }

  console.log("Derived from pushedStatus:", fromStatus);
  console.log("Derived from campaign:", fromCampaign);
  console.log("Derived from updatedAt:", fromUpdatedAt);
  console.log("Distribution by month:", monthHistogram);

  // Contacts marked pushed inherit the newest pushedAt of their email.
  const pushedContacts = await contacts
    .find(
      {
        status: "pushed",
        $or: [{ pushedAt: { $exists: false } }, { pushedAt: null }]
      },
      { email: 1 }
    )
    .lean();

  let contactsBackfilled = 0;

  for (const contact of pushedContacts as any[]) {
    const email = String(contact.email || "").trim().toLowerCase();
    const pushedAt = email ? emailPushedAt.get(email) : null;

    if (!pushedAt) continue;

    contactsBackfilled += 1;

    if (!dryRun) {
      await contacts.updateOne({ _id: contact._id }, { $set: { pushedAt } });
    }
  }

  console.log(
    "Contacts backfilled:",
    contactsBackfilled,
    "of",
    pushedContacts.length,
    "pushed contacts missing pushedAt"
  );

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
