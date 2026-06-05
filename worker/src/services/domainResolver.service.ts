import { callOpenAIWithWebSearch } from "./openaiResponses.service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cleanDomain(value: any) {
  return String(value || "")
    .trim()
    .split("\n")[0]
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function isValidDomain(domain: string) {
  const clean = cleanDomain(domain);

  if (!clean) return false;
  if (clean === "n/a") return false;
  if (clean.includes(" ")) return false;
  if (!clean.includes(".")) return false;
  if (clean.length > 100) return false;
  if (clean.includes("amazon.")) return false;
  if (clean.includes("youtube.")) return false;
  if (clean.includes("facebook.")) return false;
  if (clean.includes("instagram.")) return false;
  if (clean.includes("linkedin.")) return false;

  return true;
}

export async function findOfficialDomainForBrand(input: {
  brandName: string;
  productHint?: string;
}) {
  const brand = String(input.brandName || "").trim();
  const productHint = String(input.productHint || "").trim();

  let webPrompt = 'Search the web for the brand "' + brand + '"';

  if (productHint && productHint !== "N/A") {
    webPrompt += " (they make products like: " + productHint + ")";
  }

  webPrompt +=
    ".\n\n" +
    "IMPORTANT: You MUST visit the brand's official website. Look for the ACTUAL parent company domain.\n\n" +
    "Some brands are products under a parent company. For example:\n" +
    "- Deebot is a product line by ECOVACS, so the domain is ecovacs.com (deebot.com is just a parked domain)\n" +
    "- Roomba is a product line by iRobot, so the domain is irobot.com\n" +
    "- If a brand has its own standalone website (like ecoflow.com, bluetti.com), use that.\n\n" +
    "Find and return ONLY the official website domain in clean format (e.g., 'ecoflow.com').\n" +
    "No https://, no www., no trailing /. NOT amazon.com or any marketplace.\n\n" +
    "RESPOND with ONLY the domain, nothing else. Example: ecoflow.com\n\n" +
    "If you truly cannot find the domain after searching, respond with: N/A";

  try {
    const response = await callOpenAIWithWebSearch(webPrompt);
    const domain = cleanDomain(response);

    await sleep(1500);

    if (!isValidDomain(domain)) {
      return "";
    }

    return domain;
  } catch (error: any) {
    console.error("Domain web search failed:", brand, error.message);
    return "";
  }
}
