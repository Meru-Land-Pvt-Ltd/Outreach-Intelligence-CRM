import axios from "axios";
import { BrandMap } from "../models/BrandMap.model";
import { PipelineTracker } from "../models/PipelineTracker.model";

const BrandMapModel = BrandMap as any;
const PipelineTrackerModel = PipelineTracker as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function normalizeDomain(value: any) {
  let domain = cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim();

  domain = domain.replace(/[^a-z0-9.-]/g, "");

  if (!domain.includes(".")) return "";

  return domain;
}

function brandToDomainGuess(brandName: string) {
  const clean = brandName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

  if (!clean) return "";

  return clean + ".com";
}

async function domainHasWebsite(domain: string) {
  if (!domain) return false;

  const urls = ["https://" + domain, "https://www." + domain];

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; OutreachIntelligenceCRM/1.0)"
        }
      });

      if (response.status >= 200 && response.status < 500) {
        return true;
      }
    } catch {
      // try next
    }
  }

  return false;
}

async function lookupWithClearbit(brandName: string) {
  const baseUrl =
    process.env.CLEARBIT_NAME_TO_DOMAIN_URL ||
    "https://autocomplete.clearbit.com/v1/companies/suggest";

  try {
    const response = await axios.get(baseUrl, {
      params: {
        query: brandName
      },
      timeout: 15000,
      validateStatus: () => true
    });

    const items = Array.isArray(response.data) ? response.data : [];

    if (items.length === 0) return "";

    const exact = items.find((item: any) => {
      return (
        cleanText(item.name).toLowerCase() === brandName.toLowerCase() &&
        item.domain
      );
    });

    const selected = exact || items.find((item: any) => item.domain);

    return normalizeDomain(selected?.domain);
  } catch {
    return "";
  }
}

async function lookupWithOpenAI(brandName: string, productName?: string) {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key) return "";

  const prompt =
    "Find the official website domain for this brand.\n\n" +
    "Brand: " +
    brandName +
    "\n" +
    "Product: " +
    (productName || "N/A") +
    "\n\n" +
    "Rules:\n" +
    "1. Return only the root domain.\n" +
    "2. No https://, no www, no paths.\n" +
    "3. If unsure, return unspecified.\n\n" +
    "Output JSON only:\n" +
    '{"domain":"example.com"}';

  try {
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "Return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0
      },
      {
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    let text = String(response.data?.choices?.[0]?.message?.content || "");
    text = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : JSON.parse(text);

    const domain = normalizeDomain(json.domain);

    if (!domain || domain === "unspecified") return "";

    return domain;
  } catch {
    return "";
  }
}

export async function findOfficialDomainForBrand(brandMap: any) {
  const brandName = cleanText(brandMap.brandName);
  const productNames = Array.isArray(brandMap.productNames)
    ? brandMap.productNames
    : [];

  if (!brandName) {
    return {
      domain: "unspecified",
      status: "domain_not_found",
      source: "missing_brand"
    };
  }

  if (
    brandMap.domain &&
    brandMap.domain !== "-" &&
    brandMap.domain !== "unspecified"
  ) {
    return {
      domain: normalizeDomain(brandMap.domain),
      status: "domain_found",
      source: "existing"
    };
  }

  const clearbitDomain = await lookupWithClearbit(brandName);

  if (clearbitDomain && (await domainHasWebsite(clearbitDomain))) {
    return {
      domain: clearbitDomain,
      status: "domain_found",
      source: "clearbit"
    };
  }

  const guessedDomain = brandToDomainGuess(brandName);

  if (guessedDomain && (await domainHasWebsite(guessedDomain))) {
    return {
      domain: guessedDomain,
      status: "domain_found",
      source: "heuristic"
    };
  }

  const aiDomain = await lookupWithOpenAI(brandName, productNames[0]);

  if (aiDomain && (await domainHasWebsite(aiDomain))) {
    return {
      domain: aiDomain,
      status: "domain_found",
      source: "openai"
    };
  }

  return {
    domain: "unspecified",
    status: "domain_not_found",
    source: "not_found"
  };
}

export async function fillMissingDomainsForSeed(seedBrandName?: string) {
  const query: Record<string, any> = {
    $or: [
      { domain: { $exists: false } },
      { domain: "" },
      { domain: "-" },
      { domain: null },
      { domain: "unspecified" }
    ]
  };

  if (seedBrandName) {
    query.foundVia = seedBrandName;
  }

  const brandMaps = await BrandMapModel.find(query).sort({ createdAt: -1 });

  let domainFound = 0;
  let domainNotFound = 0;

  for (const brandMap of brandMaps as any[]) {
    const result = await findOfficialDomainForBrand(brandMap);

    await BrandMapModel.findByIdAndUpdate(brandMap._id, {
      $set: {
        domain: result.domain,
        status: result.status,
        domainSource: result.source
      }
    });

    await PipelineTrackerModel.create({
      type: "Discovered",
      brandName: brandMap.brandName,
      domain: result.domain,
      status:
        result.status === "domain_found"
          ? "Domain Found via " + result.source
          : "Domain Not Found",
      timestamp: new Date()
    });

    if (result.status === "domain_found") {
      domainFound += 1;
    } else {
      domainNotFound += 1;
    }
  }

  return {
    scanned: brandMaps.length,
    domainFound,
    domainNotFound
  };
}