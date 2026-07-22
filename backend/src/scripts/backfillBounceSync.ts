import mongoose from "mongoose";
import dotenv from "dotenv";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { BounceEvent } from "../models/BounceEvent.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

const LeadModel = InstantlyLead as any;
const BounceEventModel = BounceEvent as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return cleanText(value).toLowerCase();
}

const BOUNCED_VALUES = new Set([
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
]);

function isBouncedValue(value: any) {
  return BOUNCED_VALUES.has(cleanEmail(value));
}

// Cross-channel bounce sync backfill: every email that bounced anywhere
// (lead flags or webhook BounceEvent records) gets ALL its sibling lead
// rows stamped as bounced, so historical rows created after a bounce can
// no longer be selected or pushed from the other channel.
async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri, { compressors: ["zlib"] });

  const flagged = await LeadModel.find(
    {
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

  const bouncedEmails = new Set<string>();

  for (const row of flagged as any[]) {
    const email = cleanEmail(row.email);

    if (!email) continue;

    if (
      isBouncedValue(row.instantlyBounced) ||
      isBouncedValue(row.gatewayBounced) ||
      Boolean(row.raw?.instantlyBouncedAt)
    ) {
      bouncedEmails.add(email);
    }
  }

  const eventEmails: string[] = await BounceEventModel.distinct("email");

  for (const email of eventEmails) {
    const cleaned = cleanEmail(email);
    if (cleaned) bouncedEmails.add(cleaned);
  }

  console.log("bounced emails (lead flags):", flagged.length, "rows");
  console.log("bounced emails (bounce events):", eventEmails.length);
  console.log("distinct bounced emails total:", bouncedEmails.size);

  const emails = Array.from(bouncedEmails);
  let candidates = 0;
  let updated = 0;
  const byChannel: Record<string, number> = {};

  for (let i = 0; i < emails.length; i += 1000) {
    const chunk = emails.slice(i, i + 1000);

    const targetFilter = {
      email: { $in: chunk },
      instantlyBounced: { $in: ["", null, "Not bounced"] }
    };

    const targets = await LeadModel.find(targetFilter, {
      email: 1,
      channel: 1
    }).lean();

    candidates += targets.length;

    for (const row of targets as any[]) {
      const key = cleanText(row.channel) || "unknown";
      byChannel[key] = (byChannel[key] || 0) + 1;
    }

    if (!dryRun && targets.length > 0) {
      const result = await LeadModel.updateMany(targetFilter, {
        $set: {
          instantlyBounced: "Bounced",
          "raw.instantlyBounced": "Bounced (cross-channel backfill)",
          "raw.instantlyBouncedAt": new Date()
        }
      });

      updated += Number(result?.modifiedCount || 0);
    }
  }

  console.log(
    dryRun ? "[dry-run] rows that WOULD be stamped:" : "rows stamped:",
    dryRun ? candidates : updated
  );
  console.log("by channel:", JSON.stringify(byChannel));

  await mongoose.disconnect();
  console.log("done");
}

main().catch((error) => {
  console.error("backfill failed:", error.message);
  process.exit(1);
});
