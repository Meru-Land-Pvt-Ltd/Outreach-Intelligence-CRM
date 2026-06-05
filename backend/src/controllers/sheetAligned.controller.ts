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

function ok(res: Response, data: any[]) {
  res.json({
    success: true,
    count: data.length,
    data
  });
}

export async function getEmailDiscoveryRows(req: Request, res: Response) {
  try {
    const rows = await EmailDiscoveryModel.find({})
      .sort({ updatedAt: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getHunterRawContacts(req: Request, res: Response) {
  try {
    const rows = await HunterRawContactModel.find({})
      .sort({ updatedAt: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getApolloRawContacts(req: Request, res: Response) {
  try {
    const rows = await ApolloRawContactModel.find({})
      .sort({ updatedAt: -1 })
      .limit(3000);

    ok(res, rows);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProspeoRawContacts(req: Request, res: Response) {
  try {
    const rows = await ProspeoRawContactModel.find({})
      .sort({ updatedAt: -1 })
      .limit(3000);

    ok(res, rows);
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
