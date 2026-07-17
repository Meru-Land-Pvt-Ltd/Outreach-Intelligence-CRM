import { Request, Response } from "express";
import { ClosedDeal } from "../models/ClosedDeal.model";
import { SeedBrand } from "../models/SeedBrand.model";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import { BrandMap } from "../models/BrandMap.model";
import { PipelineTracker } from "../models/PipelineTracker.model";
import { NicheAnalysis } from "../models/NicheAnalysis.model";
import {
  cleanText,
  escapeRegex,
  normalizeBrandName,
  normalizeDomain
} from "../utils/normalize";

export async function markBrandMapExcluded(brandName: string, domain: string) {
  const conditions: any[] = [];

  if (brandName) {
    conditions.push({
      brandName: new RegExp("^" + escapeRegex(brandName) + "$", "i")
    });
  }

  if (domain) {
    conditions.push({
      domain: new RegExp("^" + escapeRegex(domain) + "$", "i")
    });
    conditions.push({
      domain: new RegExp("^www\\." + escapeRegex(domain) + "$", "i")
    });
  }

  if (conditions.length === 0) {
    return 0;
  }

  const result = await (BrandMap as any).updateMany(
    { $or: conditions },
    {
      $set: {
        isExcluded: true,
        status: "excluded",
        selectionStatus: "excluded",
        selectionUpdatedAt: new Date()
      }
    }
  );

  return Number(result?.modifiedCount || 0);
}

export async function upsertExcludedBrand(input: {
  brandName: string;
  domain: string;
  source: string;
}) {
  const brandName = cleanText(input.brandName);
  const domain = normalizeDomain(input.domain);
  const normalizedBrandName = normalizeBrandName(brandName || domain);

  if (!normalizedBrandName) {
    return null;
  }

  return (ExcludedBrand as any).findOneAndUpdate(
    {
      normalizedBrandName,
      normalizedDomain: domain
    },
    {
      $set: {
        brandName: brandName || domain,
        domain
      },
      $setOnInsert: {
        normalizedBrandName,
        normalizedDomain: domain,
        source: input.source
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

export async function getClosedDeals(req: Request, res: Response) {
  try {
    const data = await ClosedDeal.find({}).sort({ createdAt: -1 }).limit(500);

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createClosedDeal(req: Request, res: Response) {
  try {
    const {
      month,
      influencerHandle,
      brandName,
      productName,
      email,
      totalDealAmount
    } = req.body;

    if (!brandName || !productName) {
      return res.status(400).json({
        success: false,
        message: "Brand Name and Product Name are required"
      });
    }

    const closedDeal = await ClosedDeal.create({
      month: month || "",
      influencerHandle: influencerHandle || "",
      brandName,
      productName,
      email: email || "",
      totalDealAmount: Number(totalDealAmount || 0),
      crawlCount: 0
    });

    const seedBrand = await SeedBrand.create({
      brandName,
      productName,
      channel: influencerHandle || "",
      status: "pending",
      closedDealId: closedDeal._id
    });

    await ClosedDeal.findByIdAndUpdate(closedDeal._id, {
      $set: {
        seedBrandId: seedBrand._id
      }
    });

    res.json({
      success: true,
      data: {
        closedDeal,
        seedBrand,
        seedBrandId: seedBrand._id
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getExcludedBrands(req: Request, res: Response) {
  try {
    const rows = await ExcludedBrand.find({})
      .sort({ brandName: 1 })
      .limit(1000)
      .lean();

    // Enrich with the PGA score from matching Brand Map rows so the list
    // shows which exclusions are worth restoring. Brands that never got a
    // Brand Map row (e.g. xlsx imports) simply have no score.
    const brandMaps = await (BrandMap as any)
      .find({}, { brandName: 1, domain: 1, pgaScore: 1, niche: 1 })
      .lean();

    const byName = new Map<string, any>();
    const byDomain = new Map<string, any>();

    const keepBest = (map: Map<string, any>, key: string, row: any) => {
      if (!key) return;
      const existing = map.get(key);
      const better =
        !existing ||
        (typeof row.pgaScore === "number" &&
          (typeof existing.pgaScore !== "number" ||
            row.pgaScore > existing.pgaScore));
      if (better) map.set(key, row);
    };

    for (const row of brandMaps as any[]) {
      keepBest(byName, normalizeBrandName(row.brandName), row);
      keepBest(byDomain, normalizeDomain(row.domain), row);
    }

    const data = (rows as any[]).map((row) => {
      const match =
        byDomain.get(normalizeDomain(row.normalizedDomain || row.domain)) ||
        byName.get(normalizeBrandName(row.normalizedBrandName || row.brandName));

      return {
        ...row,
        pgaScore:
          match && typeof match.pgaScore === "number" ? match.pgaScore : null,
        niche: match?.niche || ""
      };
    });

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Restore: remove the brand from the exclude list AND flip its Brand Map
// rows back to pending, so future crawls and the current pipeline include it.
export async function restoreExcludedBrand(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const row: any = await ExcludedBrand.findById(id).lean();

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Excluded brand not found"
      });
    }

    const brandName = cleanText(row.brandName);
    const domain = normalizeDomain(row.normalizedDomain || row.domain);

    const conditions: any[] = [];

    if (brandName) {
      conditions.push({
        brandName: new RegExp("^" + escapeRegex(brandName) + "$", "i")
      });
    }

    if (domain) {
      conditions.push({
        domain: new RegExp("^" + escapeRegex(domain) + "$", "i")
      });
      conditions.push({
        domain: new RegExp("^www\\." + escapeRegex(domain) + "$", "i")
      });
    }

    let restoredBrandMaps = 0;

    if (conditions.length > 0) {
      const result = await (BrandMap as any).updateMany(
        { $or: conditions, selectionStatus: "excluded" },
        {
          $set: {
            selectionStatus: "pending",
            isExcluded: false,
            selectionUpdatedAt: new Date(),
            selectionUpdatedBy: String((req as any).user?.email || "restore")
          }
        }
      );

      restoredBrandMaps = Number(result?.modifiedCount || 0);

      // Rows whose status string was stamped "excluded" get a usable value back.
      await (BrandMap as any).updateMany(
        { $or: conditions, status: "excluded" },
        { $set: { status: "domain_found" } }
      );
    }

    await ExcludedBrand.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Brand restored",
      restoredBrandMaps,
      data: row
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createExcludedBrand(req: Request, res: Response) {
  try {
    const { brandName, domain } = req.body;

    if (!brandName && !domain) {
      return res.status(400).json({
        success: false,
        message: "Brand Name or Domain is required"
      });
    }

    const data = await upsertExcludedBrand({
      brandName: String(brandName || ""),
      domain: String(domain || ""),
      source: "manual"
    });

    if (!data) {
      return res.status(400).json({
        success: false,
        message: "Brand Name or Domain is required"
      });
    }

    // Also flag matching Brand Map rows so they drop out of the pipeline.
    const brandMapsExcluded = await markBrandMapExcluded(
      cleanText(brandName),
      normalizeDomain(domain)
    );

    res.json({
      success: true,
      data,
      brandMapsExcluded
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteExcludedBrand(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Excluded brand ID is required",
      });
    }

    const deleted = await ExcludedBrand.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Excluded brand not found",
      });
    }

    res.json({
      success: true,
      message: "Excluded brand deleted",
      data: deleted,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete excluded brand",
    });
  }
}

export async function getPipelineTracker(req: Request, res: Response) {
  try {
    const data = await PipelineTracker.find({})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(500);

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getNicheAnalysis(req: Request, res: Response) {
  try {
    const data = await NicheAnalysis.find({})
      .sort({ brandCount: -1, nicheName: 1 })
      .limit(500);

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
