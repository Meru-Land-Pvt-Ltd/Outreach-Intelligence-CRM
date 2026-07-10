import { Request, Response } from "express";
import { ClosedDeal } from "../models/ClosedDeal.model";
import { SeedBrand } from "../models/SeedBrand.model";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import {
  buildExcludedBrandMatch,
  normalizeBrandNameValue,
  normalizeDomainValue
} from "../utils/normalize";
import { PipelineTracker } from "../models/PipelineTracker.model";
import { NicheAnalysis } from "../models/NicheAnalysis.model";

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
    const data = await ExcludedBrand.find({}).sort({ brandName: 1 }).limit(1000);

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createExcludedBrand(req: Request, res: Response) {
  try {
    const brandName = String(req.body?.brandName || "").trim();
    const domain = normalizeDomainValue(req.body?.domain);

    if (!brandName && !domain) {
      return res.status(400).json({
        success: false,
        message: "Brand Name or Domain is required"
      });
    }

    const match = buildExcludedBrandMatch(brandName, domain);

    // Atomic upsert. There is no unique index (legacy duplicates could exist),
    // so a concurrent race can in theory still create a duplicate row; readers
    // always match by $or over normalized + legacy fields, so duplicates are
    // harmless for exclusion behavior.
    const result: any = await ExcludedBrand.updateOne(
      match as any,
      {
        $setOnInsert: {
          brandName,
          domain,
          normalizedBrandName: normalizeBrandNameValue(brandName),
          normalizedDomain: domain,
          source: "manual"
        }
      },
      { upsert: true }
    );

    const alreadyExcluded = !result.upsertedId;
    const data = await ExcludedBrand.findOne(
      result.upsertedId ? { _id: result.upsertedId } : (match as any)
    );

    res.json({
      success: true,
      data,
      alreadyExcluded,
      message: alreadyExcluded
        ? "Brand is already in the Exclude List"
        : "Brand added to the Exclude List"
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
