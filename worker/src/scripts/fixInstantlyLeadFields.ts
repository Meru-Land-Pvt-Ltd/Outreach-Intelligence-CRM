import "../config/env";
import { connectDatabase } from "../config/database";
import { fillInstantlyLeadCompetitors } from "../services/competitor.service";
import { backfillInstantlyLeadVerificationAndGateway } from "../services/instantlyLeadHygiene.service";

function readArg(name: string) {
  const prefix = "--" + name + "=";
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.substring(prefix.length).trim() : "";
}

async function main() {
  const companyName = readArg("companyName");
  const companies = companyName ? [companyName] : undefined;

  await connectDatabase();

  console.log("Fixing Instantly competitor fields...");
  const competitorResult = await fillInstantlyLeadCompetitors(companies);
  console.log("Competitor result:", JSON.stringify(competitorResult, null, 2));

  console.log("Fixing Instantly verification and gateway fields...");
  const hygieneResult = await backfillInstantlyLeadVerificationAndGateway(companies);
  console.log("Verification/gateway result:", JSON.stringify(hygieneResult, null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
