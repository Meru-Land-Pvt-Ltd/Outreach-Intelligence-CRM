import mongoose from "mongoose";
import dotenv from "dotenv";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { fillCompetitorsForCompanies } from "../controllers/instantly.controller";

dotenv.config({ path: ".env.production" });
dotenv.config();

const InstantlyLeadModel = InstantlyLead as any;

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function missingCompetitorQuery(extra: Record<string, any> = {}) {
  const query: Record<string, any> = { ...extra };

  query.companyName = extra.companyName || { $exists: true, $nin: ["", null] };

  query.$or = [
    { competitor1: { $exists: false } },
    { competitor1: "" },
    { competitor1: null },
    { competitor1: "-" },
    { competitor2: { $exists: false } },
    { competitor2: "" },
    { competitor2: null },
    { competitor2: "-" },
  ];

  return query;
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const rows = (await InstantlyLeadModel.find(missingCompetitorQuery())
    .select("companyName")
    .lean()) as Array<{ companyName?: unknown }>;

  const companySet = new Set<string>();

  for (const row of rows) {
    const companyName = cleanText(row.companyName);

    if (companyName) {
      companySet.add(companyName);
    }
  }

  const companies: string[] = Array.from(companySet);

  console.log("Empty competitor rows:", rows.length);
  console.log("Companies to fill:", companies.length);

  if (companies.length === 0) {
    console.log("No empty competitors found.");
    await mongoose.disconnect();
    return;
  }

  const result = await fillCompetitorsForCompanies(companies);

  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);

  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }

  process.exit(1);
});