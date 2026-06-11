import { Request, Response } from "express";

import { EmailDiscovery } from "../models/EmailDiscovery.model";
import { HunterRawContact } from "../models/HunterRawContact.model";
import { ApolloRawContact } from "../models/ApolloRawContact.model";
import { ProspeoRawContact } from "../models/ProspeoRawContact.model";
import { LatestReview } from "../models/LatestReview.model";
import { RunLog } from "../models/RunLog.model";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { InstantlyTemplate } from "../models/InstantlyTemplate.model";
import { PushLog } from "../models/PushLog.model";

const EmailDiscoveryModel = EmailDiscovery as any;
const HunterRawContactModel = HunterRawContact as any;
const ApolloRawContactModel = ApolloRawContact as any;
const ProspeoRawContactModel = ProspeoRawContact as any;
const LatestReviewModel = LatestReview as any;
const RunLogModel = RunLog as any;
const InstantlyLeadModel = InstantlyLead as any;
const InstantlyTemplateModel = InstantlyTemplate as any;
const PushLogModel = PushLog as any;

function getNumberQuery(value: unknown, fallback: number, max?: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return fallback;
  }

  const safeValue = Math.floor(numberValue);

  return max ? Math.min(safeValue, max) : safeValue;
}

function getPagination(req: Request) {
  const page = getNumberQuery(req.query.page, 1);
  const limit = getNumberQuery(req.query.limit, 1000, 1000);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

async function paginatedOk(
  req: Request,
  res: Response,
  model: any,
  filter: Record<string, any> = {},
  sort: Record<string, 1 | -1> = { updatedAt: -1 }
) {
  const { page, limit, skip } = getPagination(req);

  const [rows, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit),
    model.countDocuments(filter)
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasMore = page < totalPages;

  res.json({
    success: true,
    count: rows.length,
    total,
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore,
      nextPage: hasMore ? page + 1 : null
    }
  });
}

function ok(res: Response, data: any[]) {
  res.json({
    success: true,
    count: data.length,
    total: data.length,
    data
  });
}

export async function getEmailDiscoveryRows(req: Request, res: Response) {
  try {
    await paginatedOk(req, res, EmailDiscoveryModel);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getHunterRawContacts(req: Request, res: Response) {
  try {
    await paginatedOk(req, res, HunterRawContactModel);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getApolloRawContacts(req: Request, res: Response) {
  try {
    await paginatedOk(req, res, ApolloRawContactModel);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProspeoRawContacts(req: Request, res: Response) {
  try {
    await paginatedOk(req, res, ProspeoRawContactModel);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getEnoylityInstantlyRows(req: Request, res: Response) {
  try {
    const rows = await InstantlyLeadModel.find({
      channel: "Enoylity Technology"
    })
      .sort({ updatedAt: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMhdInstantlyRows(req: Request, res: Response) {
  try {
    const rows = await InstantlyLeadModel.find({
      channel: "MHD Tech"
    })
      .sort({ updatedAt: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getEnoylityTemplateRows(req: Request, res: Response) {
  try {
    const template = await InstantlyTemplateModel.findOne({
      channel: "Enoylity Technology"
    });

    const rows = [
      { field: "Subject", content: template?.subject || "" },
      { field: "Body", content: template?.body || "" },
      { field: "Follow Up 1", content: template?.followUp1 || "" },
      { field: "Follow Up 2", content: template?.followUp2 || "" }
    ];

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMhdTemplateRows(req: Request, res: Response) {
  try {
    const template = await InstantlyTemplateModel.findOne({
      channel: "MHD Tech"
    });

    const rows = [
      { field: "Subject", content: template?.subject || "" },
      { field: "Body", content: template?.body || "" },
      { field: "Follow Up 1", content: template?.followUp1 || "" },
      { field: "Follow Up 2", content: template?.followUp2 || "" }
    ];

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPushLogRows(req: Request, res: Response) {
  try {
    const rows = await PushLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(2000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getRunLogRows(req: Request, res: Response) {
  try {
    const rows = await RunLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(500);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getEnoylityReviews(req: Request, res: Response) {
  try {
    const rows = await LatestReviewModel.find({
      channel: "Enoylity Technology"
    })
      .sort({ publishedDate: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMhdReviews(req: Request, res: Response) {
  try {
    const rows = await LatestReviewModel.find({
      channel: "MHD Tech"
    })
      .sort({ publishedDate: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
