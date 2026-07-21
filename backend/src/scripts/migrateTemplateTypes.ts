import mongoose from "mongoose";
import dotenv from "dotenv";
import { InstantlyTemplate } from "../models/InstantlyTemplate.model";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

// Swap the legacy unique-per-channel template index for the compound
// {channel, templateType} index, so each channel can hold one outbound and
// one inbound template. Run AFTER deploying the backend that reads
// templateType (the old code's findOne({channel}) is ambiguous once a
// second row per channel exists).
async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri, { compressors: ["zlib"] });

  const Model = InstantlyTemplate as any;
  const collection = mongoose.connection.collection("instantlytemplates");

  const before = await collection.indexes();
  console.log("indexes before:", before.map((i: any) => i.name).join(", "));

  const missingType = await Model.countDocuments({
    templateType: { $exists: false }
  });
  const rows = await Model.find({}, { channel: 1, templateType: 1 }).lean();

  console.log(
    "rows:",
    rows
      .map((r: any) => `${r.channel} [${r.templateType || "MISSING"}]`)
      .join(" | ")
  );
  console.log("rows missing templateType:", missingType);

  if (dryRun) {
    console.log(
      "[dry-run] would: stamp missing templateType as outbound, sync",
      "indexes (drop channel_1 unique, add channel_1_templateType_1 unique).",
      "Inbound defaults are seeded automatically by the API afterwards."
    );
    await mongoose.disconnect();
    return;
  }

  const stamped = await Model.updateMany(
    { templateType: { $exists: false } },
    { $set: { templateType: "outbound" } }
  );
  console.log("stamped outbound:", stamped.modifiedCount);

  // syncIndexes drops indexes the schema no longer declares (channel_1
  // unique) and builds the declared compound unique index.
  const dropped = await Model.syncIndexes();
  console.log("dropped indexes:", JSON.stringify(dropped));

  const after = await collection.indexes();
  console.log("indexes after:", after.map((i: any) => i.name).join(", "));

  await mongoose.disconnect();
  console.log("done");
}

main().catch((error) => {
  console.error("migration failed:", error.message);
  process.exit(1);
});
