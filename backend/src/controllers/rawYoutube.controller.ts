import { Request, Response } from "express";
import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";

function getLimit(value: any) {
  const raw = String(value || "").trim().toLowerCase();

  if (["all", "max", "full"].includes(raw)) {
    return 5000;
  }

  const parsed = Number(value || 1000);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1000;
  }

  return Math.min(parsed, 5000);
}

export async function getRawYoutubeVideos(req: Request, res: Response) {
  try {
    const seedBrandId = req.query.seedBrandId as string | undefined;
    const limit = getLimit(req.query.limit);

    const filter: Record<string, any> = {};

    if (seedBrandId) {
      filter.seedBrandId = seedBrandId;
    }

    const videos = await RawYoutubeVideo.find(filter)
      .sort({ addedOn: -1, publishedDate: -1, createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: videos.length,
      data: videos
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
