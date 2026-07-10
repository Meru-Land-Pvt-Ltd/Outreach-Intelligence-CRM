import mongoose from "mongoose";
import dotenv from "dotenv";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import { normalizeBrandName, normalizeDomain } from "../utils/normalize";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

function normalizedKey(row: any) {
  const normalizedBrandName =
    String(row.normalizedBrandName || "") ||
    normalizeBrandName(row.brandName || row.domain);
  const normalizedDomain =
    String(row.normalizedDomain || "") || normalizeDomain(row.domain);

  return {
    normalizedBrandName: normalizedBrandName || normalizedDomain,
    normalizedDomain,
    key: (normalizedBrandName || normalizedDomain) + "||" + normalizedDomain
  };
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const collection = (ExcludedBrand as any).collection;
  const rows = await collection.find({}).toArray();

  console.log("Excluded brands total:", rows.length);
  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");

  // Step 1: backfill normalized fields on legacy rows.
  let normalized = 0;
  let unusable = 0;

  for (const row of rows) {
    if (row.normalizedBrandName) continue;

    const { normalizedBrandName, normalizedDomain } = normalizedKey(row);

    if (!normalizedBrandName) {
      unusable += 1;
      console.log("  Unusable row (no brand or domain):", String(row._id));
      continue;
    }

    normalized += 1;

    if (!dryRun) {
      await collection.updateOne(
        { _id: row._id },
        {
          $set: {
            normalizedBrandName,
            normalizedDomain,
            source: row.source || "legacy"
          }
        }
      );
    }
  }

  console.log("Rows normalized:", normalized, "| unusable:", unusable);

  // Step 2: dedupe on the normalized pair, keeping the oldest row.
  const byKey = new Map<string, any[]>();

  for (const row of rows) {
    const { key, normalizedBrandName } = normalizedKey(row);

    if (!normalizedBrandName) continue;

    if (!byKey.has(key)) {
      byKey.set(key, []);
    }

    byKey.get(key)!.push(row);
  }

  let duplicatesRemoved = 0;

  for (const [key, group] of byKey.entries()) {
    if (group.length <= 1) continue;

    group.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
    );

    const toDelete = group.slice(1).map((row) => row._id);

    duplicatesRemoved += toDelete.length;
    console.log(
      "  Duplicate group:",
      key,
      "keeping oldest, removing",
      toDelete.length
    );

    if (!dryRun) {
      await collection.deleteMany({ _id: { $in: toDelete } });
    }
  }

  console.log("Duplicates removed:", duplicatesRemoved);

  // Step 3: unique index on the normalized pair (no-op if it exists).
  if (!dryRun) {
    await collection.createIndex(
      { normalizedBrandName: 1, normalizedDomain: 1 },
      { unique: true }
    );
    console.log("Unique index ensured on (normalizedBrandName, normalizedDomain).");
  } else {
    console.log("Dry run: skipping index creation.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
