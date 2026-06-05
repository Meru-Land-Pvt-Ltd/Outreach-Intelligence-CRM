import { Request, Response } from "express";
import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";

export async function getRawYoutubeVideos(req: Request, res: Response) {
  try {
    const seedBrandId = req.query.seedBrandId as string | undefined;
    const limit = Number(req.query.limit || 100);

    const filter: Record<string, any> = {};

    if (seedBrandId) {
      filter.seedBrandId = seedBrandId;
    }

    const videos = await RawYoutubeVideo.find(filter)
      .sort({ publishedDate: -1, createdAt: -1 })
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
