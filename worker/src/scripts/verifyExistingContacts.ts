import mongoose from "mongoose";
import { env } from "../config/env";
import { verifyContactsForSeedBrand } from "../services/emailVerifier.service";

async function main() {
  await mongoose.connect(env.mongodbUri);

  const seedBrandId = process.argv[2];

  if (!seedBrandId) {
    console.error("Usage: npm --prefix worker exec tsx src/scripts/verifyExistingContacts.ts SEED_BRAND_ID");
    process.exit(1);
  }

  const result = await verifyContactsForSeedBrand(seedBrandId);

  console.log(result);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
