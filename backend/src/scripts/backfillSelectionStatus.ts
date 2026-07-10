import mongoose from "mongoose";
import dotenv from "dotenv";
import { BrandMap } from "../models/BrandMap.model";
import { InstantlyLead } from "../models/InstantlyLead.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const brandMaps = (BrandMap as any).collection;
  const leads = InstantlyLead as any;

  const missingFilter = { selectionStatus: { $exists: false } };
  const missingTotal = await brandMaps.countDocuments(missingFilter);

  console.log("Brand map rows without selectionStatus:", missingTotal);
  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");

  // 1) Already-excluded rows stay excluded.
  const excludedFilter = {
    ...missingFilter,
    $or: [{ isExcluded: true }, { status: "excluded" }]
  };

  const excludedCount = await brandMaps.countDocuments(excludedFilter);

  if (!dryRun && excludedCount > 0) {
    await brandMaps.updateMany(excludedFilter, {
      $set: {
        selectionStatus: "excluded",
        selectionUpdatedAt: new Date(),
        selectionUpdatedBy: "backfill-script"
      }
    });
  }

  console.log("→ excluded:", excludedCount);

  // 2) Brands already pushed to Instantly count as approved, so the
  //    cooling-off view and per-brand caps stay coherent with history.
  const pushedFilter = { pushedStatus: { $nin: ["", null] } };

  const pushedCompanyNames = (
    await leads.distinct("companyName", pushedFilter)
  )
    .map((name: any) => String(name || "").trim())
    .filter(Boolean);

  const pushedBrandMapIds = (await leads.distinct("brandMapId", pushedFilter))
    .map((id: any) => String(id || ""))
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .map((id: string) => new mongoose.Types.ObjectId(id));

  const approvedFilter = {
    ...missingFilter,
    $or: [
      { _id: { $in: pushedBrandMapIds } },
      { brandName: { $in: pushedCompanyNames } }
    ]
  };

  const approvedCount = await brandMaps.countDocuments(approvedFilter);

  if (!dryRun && approvedCount > 0) {
    await brandMaps.updateMany(approvedFilter, {
      $set: {
        selectionStatus: "approved",
        selectionUpdatedAt: new Date(),
        selectionUpdatedBy: "backfill-script"
      }
    });
  }

  console.log(
    "→ approved (already pushed):",
    approvedCount,
    "| pushed companies:",
    pushedCompanyNames.length
  );

  // 3) Everything else needs explicit approval from now on.
  const pendingCount = await brandMaps.countDocuments(missingFilter);
  const pendingToSet = dryRun
    ? Math.max(missingTotal - excludedCount - approvedCount, 0)
    : pendingCount;

  if (!dryRun && pendingCount > 0) {
    await brandMaps.updateMany(missingFilter, {
      $set: {
        selectionStatus: "pending",
        selectionUpdatedAt: new Date(),
        selectionUpdatedBy: "backfill-script"
      }
    });
  }

  console.log("→ pending:", pendingToSet);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
