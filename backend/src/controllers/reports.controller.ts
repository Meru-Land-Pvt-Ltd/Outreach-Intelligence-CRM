import { Request, Response } from "express";
import { BrandMap } from "../models/BrandMap.model";
import { SeedBrand } from "../models/SeedBrand.model";
import { ClosedDeal } from "../models/ClosedDeal.model";
import { Contact } from "../models/Contact.model";
import { EmailDiscovery } from "../models/EmailDiscovery.model";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { CreditUsage } from "../models/CreditUsage.model";
import { buildCsv } from "../utils/csv";
import { normalizeDomainValue } from "../utils/normalize";
import { getInstantlyBouncedStatusForResponse } from "./instantly.controller";

const BrandMapModel = BrandMap as any;
const SeedBrandModel = SeedBrand as any;
const ClosedDealModel = ClosedDeal as any;
const ContactModel = Contact as any;
const EmailDiscoveryModel = EmailDiscovery as any;
const InstantlyLeadModel = InstantlyLead as any;
const CreditUsageModel = CreditUsage as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function lowerKey(value: any) {
  return cleanText(value).toLowerCase();
}

type LeadRollup = {
  channels: Set<string>;
  total: number;
  pushed: number;
  bounced: number;
  bounceReason: string;
};

async function buildLeadRollupByCompany() {
  const leads: any[] = await InstantlyLeadModel.find({})
    .select("companyName channel pushedStatus instantlyBounced bounceReason raw.bounceReason raw.instantlyBounced")
    .lean();

  const byCompany = new Map<string, LeadRollup>();

  for (const lead of leads) {
    const key = lowerKey(lead.companyName);

    if (!key) continue;

    if (!byCompany.has(key)) {
      byCompany.set(key, {
        channels: new Set<string>(),
        total: 0,
        pushed: 0,
        bounced: 0,
        bounceReason: ""
      });
    }

    const rollup = byCompany.get(key)!;

    rollup.total += 1;
    if (cleanText(lead.channel)) rollup.channels.add(cleanText(lead.channel));
    if (cleanText(lead.pushedStatus)) rollup.pushed += 1;

    const bouncedLabel = getInstantlyBouncedStatusForResponse(lead);

    if (bouncedLabel !== "Not bounced") {
      rollup.bounced += 1;

      if (!rollup.bounceReason) {
        const reasonMatch = bouncedLabel.match(/^Bounced - (.+)$/);
        rollup.bounceReason = reasonMatch ? reasonMatch[1] : "";
      }
    }
  }

  return byCompany;
}

async function buildContactCountByBrand() {
  const rows: any[] = await ContactModel.aggregate([
    {
      $match: {
        email: { $exists: true, $nin: ["", null] },
        status: { $nin: ["invalid", "bounced", "skipped"] }
      }
    },
    {
      $group: {
        _id: { brand: { $toLower: "$brandName" }, domain: { $toLower: "$domain" } },
        count: { $sum: 1 }
      }
    }
  ]);

  const map = new Map<string, number>();

  for (const row of rows) {
    map.set(`${row._id.brand}::${row._id.domain}`, Number(row.count || 0));
  }

  return map;
}

async function buildCreditRollupByDomain() {
  const rows: any[] = await CreditUsageModel.aggregate([
    {
      $group: {
        _id: "$normalizedDomain",
        credits: { $sum: "$credits" },
        actual: { $sum: { $cond: [{ $eq: ["$usageType", "actual"] }, 1, 0] } },
        estimated: { $sum: { $cond: [{ $eq: ["$usageType", "estimated"] }, 1, 0] } }
      }
    }
  ]);

  const map = new Map<string, { credits: number; usageType: string }>();

  for (const row of rows) {
    const key = cleanText(row._id);

    if (!key) continue;

    map.set(key, {
      credits: Number(row.credits || 0),
      usageType:
        Number(row.estimated || 0) > 0
          ? Number(row.actual || 0) > 0
            ? "mixed"
            : "estimated"
          : "actual"
    });
  }

  return map;
}

async function buildDiscoveryMap() {
  const rows: any[] = await EmailDiscoveryModel.find({})
    .select("brandName domain totalEmails contactsSelected discoveryStatus")
    .lean();

  const map = new Map<string, any>();

  for (const row of rows) {
    map.set(`${lowerKey(row.brandName)}::${normalizeDomainValue(row.domain)}`, row);
  }

  return map;
}

function countDiscoveredEmails(discovery: any) {
  const fromStatus = Number(discovery?.discoveryStatus?.contactsDiscovered);

  if (Number.isFinite(fromStatus) && fromStatus > 0) return fromStatus;

  const cell = cleanText(discovery?.totalEmails);

  if (!cell || cell.startsWith("(")) return 0;

  return cell.split("\n").filter((line) => line.includes("@")).length;
}

const CSV_HEADERS = [
  "seed brand",
  "niche",
  "brand name",
  "domain",
  "selected",
  "excluded",
  "quality score",
  "intent score",
  "pga score",
  "emails discovered",
  "contacts selected",
  "emails pushed",
  "channel",
  "pushed status",
  "instantly bounced",
  "bounce reason",
  "campaign source",
  "credits used",
  "credit usage type",
  "replies",
  "closed deals",
  "created date",
  "updated date"
];

// CSV export compatible with the marketing conversion sheet. Reply data has
// no source in this system yet, so the column is left blank instead of
// inventing values.
export async function exportConversionCsv(req: Request, res: Response) {
  try {
    const filter: Record<string, any> = {};

    if (cleanText(req.query.seedBrandName)) {
      filter.$or = [
        { seedBrandName: cleanText(req.query.seedBrandName) },
        { foundVia: cleanText(req.query.seedBrandName) }
      ];
    }

    const brands: any[] = await BrandMapModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const [leadRollup, contactCounts, creditRollup, discoveryMap, closedDeals] =
      await Promise.all([
        buildLeadRollupByCompany(),
        buildContactCountByBrand(),
        buildCreditRollupByDomain(),
        buildDiscoveryMap(),
        ClosedDealModel.find({}).select("brandName").lean()
      ]);

    const dealCounts = new Map<string, number>();

    for (const deal of closedDeals as any[]) {
      const key = lowerKey(deal.brandName);
      if (!key) continue;
      dealCounts.set(key, (dealCounts.get(key) || 0) + 1);
    }

    const rows = brands.map((brand) => {
      const brandKey = lowerKey(brand.brandName);
      const domainKey = normalizeDomainValue(brand.domain);
      const leads = leadRollup.get(brandKey);
      const credits = creditRollup.get(domainKey);
      const discovery = discoveryMap.get(`${brandKey}::${domainKey}`);
      const contactCount = contactCounts.get(`${brandKey}::${domainKey}`) || 0;

      return {
        "seed brand": cleanText(brand.seedBrandName || brand.foundVia),
        niche: cleanText(brand.niche),
        "brand name": cleanText(brand.brandName),
        domain: domainKey,
        selected: brand.isSelected === true ? "yes" : "no",
        excluded: brand.isExcluded === true ? "yes" : "no",
        "quality score": Number.isFinite(Number(brand.qualityScore))
          ? brand.qualityScore
          : "",
        "intent score": Number.isFinite(Number(brand.intentScore))
          ? brand.intentScore
          : "",
        "pga score": Number.isFinite(Number(brand.pgaScore)) ? brand.pgaScore : "",
        "emails discovered": discovery ? countDiscoveredEmails(discovery) : contactCount,
        "contacts selected": discovery?.contactsSelected ?? Math.min(contactCount, 4),
        "emails pushed": leads?.pushed || 0,
        channel: leads ? Array.from(leads.channels).join("; ") : "",
        "pushed status": leads ? `${leads.pushed} of ${leads.total} pushed` : "",
        "instantly bounced": leads?.bounced || 0,
        "bounce reason": leads?.bounceReason || "",
        "campaign source": cleanText(brand.foundVia || brand.seedBrandName),
        "credits used": credits?.credits || 0,
        "credit usage type": credits?.usageType || "",
        replies: "",
        "closed deals": dealCounts.get(brandKey) || 0,
        "created date": brand.createdAt || "",
        "updated date": brand.updatedAt || ""
      };
    });

    const csv = buildCsv(CSV_HEADERS, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="conversion-export.csv"'
    );
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Per-seed rollup: credits vs results, to spot bad seeds early. Replies have
// no data source yet and are reported as null.
export async function getSeedSummary(req: Request, res: Response) {
  try {
    const seeds: any[] = await SeedBrandModel.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const brands: any[] = await BrandMapModel.find({})
      .select("seedBrandId seedBrandName foundVia brandName domain isSelected isExcluded")
      .lean();

    const [leadRollup, contactCounts, creditRollup, closedDeals] = await Promise.all([
      buildLeadRollupByCompany(),
      buildContactCountByBrand(),
      buildCreditRollupByDomain(),
      ClosedDealModel.find({}).select("brandName seedBrandId").lean()
    ]);

    const data = seeds.map((seed) => {
      const seedId = String(seed._id);
      const seedName = cleanText(seed.brandName);

      const seedBrands = brands.filter(
        (brand) =>
          String(brand.seedBrandId || "") === seedId ||
          cleanText(brand.foundVia) === seedName ||
          cleanText(brand.seedBrandName) === seedName
      );

      let contactsFound = 0;
      let contactsSelected = 0;
      let pushed = 0;
      let bounced = 0;
      let credits = 0;
      let hasEstimated = false;
      let hasActual = false;

      for (const brand of seedBrands) {
        const brandKey = lowerKey(brand.brandName);
        const domainKey = normalizeDomainValue(brand.domain);
        const contactCount = contactCounts.get(`${brandKey}::${domainKey}`) || 0;
        const leads = leadRollup.get(brandKey);
        const credit = creditRollup.get(domainKey);

        contactsFound += contactCount;
        contactsSelected += Math.min(contactCount, 4);
        pushed += leads?.pushed || 0;
        bounced += leads?.bounced || 0;

        if (credit) {
          credits += credit.credits;
          if (credit.usageType === "estimated" || credit.usageType === "mixed") {
            hasEstimated = true;
          }
          if (credit.usageType === "actual" || credit.usageType === "mixed") {
            hasActual = true;
          }
        }
      }

      const deals = (closedDeals as any[]).filter(
        (deal) => String(deal.seedBrandId || "") === seedId
      ).length;

      const brandsSelected = seedBrands.filter((brand) => brand.isSelected === true)
        .length;

      return {
        seedBrandId: seedId,
        seedBrandName: seedName,
        month: cleanText(seed.month),
        status: cleanText(seed.status),
        crawlLimit: Number(seed.crawlLimit || 0),
        brandsFound: seedBrands.length,
        brandsSelected,
        brandsExcluded: seedBrands.filter((brand) => brand.isExcluded === true).length,
        contactsFound,
        contactsSelected,
        pushed,
        bounced,
        replies: null,
        deals,
        creditsUsed: credits,
        creditUsageType: hasEstimated && hasActual
          ? "mixed"
          : hasEstimated
            ? "estimated"
            : hasActual
              ? "actual"
              : "",
        creditsPerSelectedBrand:
          brandsSelected > 0 ? Math.round((credits / brandsSelected) * 100) / 100 : null,
        creditsPerPushedLead:
          pushed > 0 ? Math.round((credits / pushed) * 100) / 100 : null
      };
    });

    res.json({ success: true, count: data.length, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
