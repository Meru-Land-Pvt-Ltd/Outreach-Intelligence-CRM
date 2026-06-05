import { Request, Response } from "express";
import { Contact } from "../models/Contact.model";

export async function getContacts(req: Request, res: Response) {
  try {
    const seedBrandId = req.query.seedBrandId as string | undefined;
    const brandMapId = req.query.brandMapId as string | undefined;
    const source = req.query.source as string | undefined;
    const limit = Number(req.query.limit || 200);

    const filter: Record<string, any> = {};

    if (seedBrandId) {
      filter.seedBrandId = seedBrandId;
    }

    if (brandMapId) {
      filter.brandMapId = brandMapId;
    }

    if (source) {
      filter.source = source;
    }

    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
