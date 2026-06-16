import { InstantlyLead } from "../models/InstantlyLead.model";
import { callOpenAIText } from "./ai.service";
import { buildCompetitorFinderPrompt } from "../prompts/competitorFinder.prompt";

const InstantlyLeadModel = InstantlyLead as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function isWeak(value: any) {
  const text = cleanText(value).toLowerCase();

  return !text || text === "-" || text === "n/a" || text === "na";
}

function parseCompetitorJson(text: string) {
  const cleaned = String(text || "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  const json = match ? JSON.parse(match[0]) : JSON.parse(cleaned);
  const rows = Array.isArray(json?.results) ? json.results : [];

  return rows
    .map((row: any) => ({
      brand: cleanText(row.brand || row.companyName || row.company || row.name),
      competitor1: cleanText(row.competitor1 || row.Competitor1 || row["Competitor 1"]),
      competitor2: cleanText(row.competitor2 || row.Competitor2 || row["Competitor 2"])
    }))
    .filter((row: any) => row.brand && (row.competitor1 || row.competitor2));
}

async function getCompaniesNeedingCompetitors(companyNames?: string[]) {
  const query: Record<string, any> = {
    companyName: { $exists: true, $nin: ["", null] },
    $or: [
      { competitor1: { $exists: false } },
      { competitor1: "" },
      { competitor1: null },
      { competitor1: "-" },
      { competitor2: { $exists: false } },
      { competitor2: "" },
      { competitor2: null },
      { competitor2: "-" }
    ]
  };

  if (companyNames && companyNames.length > 0) {
    query.companyName = { $in: companyNames.map(cleanText).filter(Boolean) };
  }

  const rows = await InstantlyLeadModel.find(query)
    .select("companyName")
    .sort({ companyName: 1 })
    .lean();

  return Array.from(
    new Set(
      (rows as any[])
        .map((row) => cleanText(row.companyName))
        .filter(Boolean)
    )
  );
}

export async function fillInstantlyLeadCompetitors(companyNames?: string[]) {
  const companies = await getCompaniesNeedingCompetitors(companyNames);

  const batchSize = Math.max(Number(process.env.COMPETITOR_FILL_BATCH_SIZE || 20), 1);
  let updated = 0;
  let failed = 0;
  const results: any[] = [];

  for (let index = 0; index < companies.length; index += batchSize) {
    const batch = companies.slice(index, index + batchSize);

    if (batch.length === 0) continue;

    console.log(
      "Competitor fill batch started:",
      index + 1,
      "-",
      index + batch.length,
      "of",
      companies.length
    );

    try {
      const text = await callOpenAIText(buildCompetitorFinderPrompt(batch));
      const parsedRows = parseCompetitorJson(text);
      const byBrand: Record<string, any> = {};

      for (const row of parsedRows) {
        byBrand[row.brand.toLowerCase()] = row;
      }

      for (const companyName of batch) {
        const competitors = byBrand[companyName.toLowerCase()];

        if (!competitors) {
          failed += 1;
          results.push({ companyName, updated: 0, reason: "not_returned_by_openai" });
          continue;
        }

        const competitor1 = cleanText(competitors.competitor1);
        const competitor2 = cleanText(competitors.competitor2);

        if (!competitor1 && !competitor2) {
          failed += 1;
          results.push({ companyName, updated: 0, reason: "empty_competitors" });
          continue;
        }

        const result = await InstantlyLeadModel.updateMany(
          {
            companyName,
            $or: [
              { competitor1: { $exists: false } },
              { competitor1: "" },
              { competitor1: null },
              { competitor1: "-" },
              { competitor2: { $exists: false } },
              { competitor2: "" },
              { competitor2: null },
              { competitor2: "-" }
            ]
          },
          {
            $set: {
              competitor1,
              competitor2
            }
          }
        );

        updated += result.modifiedCount || 0;
        results.push({
          companyName,
          competitor1,
          competitor2,
          updated: result.modifiedCount || 0
        });
      }
    } catch (error: any) {
      failed += batch.length;
      console.error("Competitor fill batch failed:", error?.message || error);

      for (const companyName of batch) {
        results.push({ companyName, updated: 0, reason: error?.message || String(error) });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const stillEmpty = await InstantlyLeadModel.countDocuments({
    companyName: { $exists: true, $nin: ["", null] },
    $or: [
      { competitor1: { $exists: false } },
      { competitor1: "" },
      { competitor1: null },
      { competitor1: "-" },
      { competitor2: { $exists: false } },
      { competitor2: "" },
      { competitor2: null },
      { competitor2: "-" }
    ]
  });

  return {
    companies: companies.length,
    updated,
    failed,
    stillEmpty,
    results
  };
}

export function leadHasMissingCompetitors(lead: any) {
  return isWeak(lead?.competitor1) || isWeak(lead?.competitor2);
}
