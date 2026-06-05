import { Request, Response } from "express";
import { SeedBrand } from "../models/SeedBrand.model";

export async function createSeedBrand(req: Request, res: Response) {
  try {
    const seedBrand = await SeedBrand.create(req.body);

    res.status(201).json({
      success: true,
      data: seedBrand
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getSeedBrands(req: Request, res: Response) {
  try {
    const seedBrands = await SeedBrand.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: seedBrands
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}