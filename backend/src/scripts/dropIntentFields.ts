import mongoose from "mongoose";
import dotenv from "dotenv";
import { BrandMap } from "../models/BrandMap.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

// The intent-scoring rubric was replaced by the 4-criterion PGA score.
// Old intent values must not masquerade as PGA averages, so they are dropped.
async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const collection = (BrandMap as any).collection;

  const affected = await collection.countDocuments({
    $or: [
      { intentScore: { $exists: true } },
      { intentStatus: { $exists: true } },
      { intentCheckedAt: { $exists: true } }
    ]
  });

  console.log("Brand map rows with legacy intent fields:", affected);
  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");

  if (!dryRun && affected > 0) {
    const result = await collection.updateMany(
      {},
      {
        $unset: {
          intentScore: "",
          intentSummary: "",
          intentSignals: "",
          intentCheckedAt: "",
          intentStatus: "",
          intentRaw: ""
        }
      }
    );

    console.log("Rows modified:", result.modifiedCount);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
