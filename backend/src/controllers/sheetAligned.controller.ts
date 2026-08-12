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
import { scheduleInstantlyBackendMaintenance } from "./instantly.controller";

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


function cleanText(value: any) {
  return String(value || "").trim();
}

function getInstantlyBouncedStatusForResponse(lead: any) {
  const value =
    cleanText(lead.instantlyBounced) ||
    cleanText(lead.instantlyBounceStatus) ||
    cleanText(lead.bouncedStatus) ||
    cleanText(lead.bounceStatus) ||
    cleanText(lead.raw?.instantlyBounced) ||
    cleanText(lead.raw?.instantlyBounceStatus) ||
    cleanText(lead.raw?.bouncedStatus) ||
    cleanText(lead.raw?.bounceStatus);

  if (value) return value;

  if (lead.isBounced || lead.raw?.isBounced) {
    const reason = cleanText(lead.bounceReason || lead.raw?.bounceReason);
    return reason ? `Bounced - ${reason}` : "Bounced";
  }

  if (cleanText(lead.bouncedAt || lead.raw?.bouncedAt)) {
    return "Bounced";
  }

  return "Not bounced";
}

function isInstantlyBouncedValue(value: any) {
  const lower = cleanText(value).toLowerCase();

  if (!lower) return false;

  return lower.includes("bounce");
}

function getVerificationStatusForResponse(lead: any) {
  const verificationStatus = cleanText(lead?.verificationStatus);

  if (
    verificationStatus.toLowerCase() === "bounced" &&
    isInstantlyBouncedValue(getInstantlyBouncedStatusForResponse(lead))
  ) {
    return "Pending Verification";
  }

  return verificationStatus;
}

function normalizeInstantlyLeadForResponse(row: any) {
  const lead = row?.toObject ? row.toObject() : row;

  return {
    ...lead,
    verificationStatus: getVerificationStatusForResponse(lead),
    instantlyBounced: getInstantlyBouncedStatusForResponse(lead)
  };
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
    scheduleInstantlyBackendMaintenance({
      channel: "Enoylity Technology",
      reason: "enoylity-instantly-read"
    });
    const rows = await InstantlyLeadModel.find({
      channel: "Enoylity Technology"
    })
      .select("-raw -releaseHistory")
      .sort({ updatedAt: -1 })
      .limit(3000)
      .lean();

    ok(res, rows.map(normalizeInstantlyLeadForResponse));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMhdInstantlyRows(req: Request, res: Response) {
  try {
    scheduleInstantlyBackendMaintenance({
      channel: "MHD Tech",
      reason: "mhd-instantly-read"
    });
    const rows = await InstantlyLeadModel.find({
      channel: "MHD Tech"
    })
      .select("-raw -releaseHistory")
      .sort({ updatedAt: -1 })
      .limit(3000)
      .lean();

    ok(res, rows.map(normalizeInstantlyLeadForResponse));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Multiple named templates can exist per channel+type; the sheet view shows
// the requested name, falling back to "Default", then the oldest one.
async function findTemplateForRows(req: Request, channel: string) {
  const templateType = templateTypeFromQuery(req);
  const name = String(req.query.name || "").trim();

  if (name) {
    const byName = await InstantlyTemplateModel.findOne({
      channel,
      templateType,
      name
    });

    if (byName) return byName;
  }

  const byDefault = await InstantlyTemplateModel.findOne({
    channel,
    templateType,
    name: "Default"
  });

  if (byDefault) return byDefault;

  return InstantlyTemplateModel.findOne({ channel, templateType }).sort({
    createdAt: 1
  });
}

function templateTypeFromQuery(req: Request) {
  return String(req.query.type || "").trim().toLowerCase() === "inbound"
    ? "inbound"
    : "outbound";
}

export async function getEnoylityTemplateRows(req: Request, res: Response) {
  try {
    const template = await findTemplateForRows(
      req,
      "Enoylity Technology"
    );

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
    const template = await findTemplateForRows(req, "MHD Tech");

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
