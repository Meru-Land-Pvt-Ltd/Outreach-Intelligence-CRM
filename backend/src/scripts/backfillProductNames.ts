import mongoose from "mongoose";
import dotenv from "dotenv";
import { InstantlyLead } from "../models/InstantlyLead.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const leads = InstantlyLead as any;

  const rows = await leads
    .find(
      {
        $or: [{ productName: { $exists: false } }, { productName: { $in: ["", null] } }],
        companyName: { $nin: ["", null] }
      },
      { companyName: 1, email: 1, channel: 1 }
    )
    .lean();

  console.log("Leads with empty productName:", rows.length);
  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");

  let updated = 0;

  for (const row of rows as any[]) {
    const companyName = String(row.companyName || "").trim();

    if (!companyName) continue;

    const productName = companyName + " products";

    if (updated < 20) {
      console.log(" ", row.channel, row.email, "→", productName);
    }

    updated += 1;

    if (!dryRun) {
      await leads.updateOne({ _id: row._id }, { $set: { productName } });
    }
  }

  console.log("Leads updated:", updated);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
