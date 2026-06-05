import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import XLSX from "xlsx";

dotenv.config();

const ExcludedBrandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true
    },
    domain: {
      type: String,
      default: ""
    },
    normalizedBrandName: {
      type: String,
      required: true
    },
    normalizedDomain: {
      type: String,
      default: ""
    },
    source: {
      type: String,
      default: "xlsx_import"
    }
  },
  { timestamps: true }
);

ExcludedBrandSchema.index(
  {
    normalizedBrandName: 1,
    normalizedDomain: 1
  },
  {
    unique: true
  }
);

const ExcludedBrand: any =
  mongoose.models.ExcludedBrand ||
  mongoose.model("ExcludedBrand", ExcludedBrandSchema);

function cleanText(value: any) {
  return String(value || "").trim();
}

function normalizeBrandName(value: any) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomain(value: any) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findColumn(row: Record<string, any>, possibleNames: string[]) {
  const keys = Object.keys(row);

  for (const possibleName of possibleNames) {
    const found = keys.find(
      (key) => key.trim().toLowerCase() === possibleName.trim().toLowerCase()
    );

    if (found) {
      return found;
    }
  }

  return "";
}

async function main() {
  const inputPathFromArg = process.argv[2];

  if (!inputPathFromArg) {
    throw new Error(
      "Please pass Excel path. Example: npx tsx src/scripts/importExcludedBrands.ts ../excluded.xlsx"
    );
  }

  const inputPath = path.resolve(process.cwd(), inputPathFromArg);

  if (!fs.existsSync(inputPath)) {
    throw new Error("Excel file not found: " + inputPath);
  }

  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const workbook = XLSX.readFile(inputPath);
  const sheetName =
    workbook.SheetNames.find((name) =>
      name.toLowerCase().includes("excluded")
    ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("No worksheet found in file");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: ""
  });

  if (rows.length === 0) {
    throw new Error("No rows found in worksheet: " + sheetName);
  }

  const sampleRow = rows[0];

  const brandColumn = findColumn(sampleRow, [
    "Brand Name",
    "Brand",
    "Company",
    "Company Name"
  ]);

  const domainColumn = findColumn(sampleRow, [
    "Domain",
    "Website",
    "Website Domain",
    "URL"
  ]);

  if (!brandColumn) {
    throw new Error(
      "Brand column not found. Expected column like: Brand Name"
    );
  }

  const parsedRows = rows
    .map((row) => {
      const brandName = cleanText(row[brandColumn]);
      const domain = domainColumn ? normalizeDomain(row[domainColumn]) : "";

      return {
        brandName,
        domain,
        normalizedBrandName: normalizeBrandName(brandName),
        normalizedDomain: domain
      };
    })
    .filter((row) => row.brandName && row.normalizedBrandName);

  const uniqueMap = new Map<string, any>();

  for (const row of parsedRows) {
    const key = row.normalizedBrandName + "|" + row.normalizedDomain;

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, row);
    }
  }

  const uniqueRows = Array.from(uniqueMap.values());

  let insertedOrUpdated = 0;

  for (const row of uniqueRows) {
    await ExcludedBrand.findOneAndUpdate(
      {
        normalizedBrandName: row.normalizedBrandName,
        normalizedDomain: row.normalizedDomain
      },
      {
        $set: {
          brandName: row.brandName,
          domain: row.domain,
          normalizedBrandName: row.normalizedBrandName,
          normalizedDomain: row.normalizedDomain,
          source: "xlsx_import"
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    insertedOrUpdated += 1;
  }

  const brandMaps = mongoose.connection.collection("brandmaps");

  let brandMapMatched = 0;

  for (const row of uniqueRows) {
    const orFilters: any[] = [
      {
        brandName: {
          $regex: "^" + escapeRegex(row.brandName) + "$",
          $options: "i"
        }
      }
    ];

    if (row.domain) {
      orFilters.push({
        domain: row.domain
      });

      orFilters.push({
        domain: "www." + row.domain
      });
    }

    const result = await brandMaps.updateMany(
      {
        $or: orFilters
      },
      {
        $set: {
          isExcluded: true,
          status: "excluded",
          excludedAt: new Date(),
          excludedReason: "Imported from excluded brand list"
        }
      }
    );

    brandMapMatched += result.modifiedCount || 0;
  }

  console.log({
    sheetName,
    rowsRead: rows.length,
    validRows: parsedRows.length,
    uniqueRows: uniqueRows.length,
    insertedOrUpdated,
    brandMapMatched
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Import excluded brands failed:");
  console.error(error.message || error);

  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }

  process.exit(1);
});
