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

function getPage(value: any) {
  const parsed = Number(value || 1);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }

  return parsed;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getRawYoutubeVideos(req: Request, res: Response) {
  try {
    const seedBrandId = req.query.seedBrandId as string | undefined;
    const search = String(req.query.search || "").trim();
    const foundVia = String(req.query.foundVia || "").trim();

    const page = getPage(req.query.page);
    const limit = getLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (seedBrandId) {
      filter.seedBrandId = seedBrandId;
    }

    if (foundVia) {
      filter.seedBrandName = foundVia;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { seedBrandName: regex },
        { channelName: regex },
        { channelId: regex },
        { videoTitle: regex },
        { videoUrl: regex },
        { videoDescription: regex },
        { channelCountry: regex },
        { channelCategory: regex },
        { category: regex },
        { sponsorBrand: regex },
        { promoCode: regex },
        { productNameWithModel: regex },
        { productName: regex },
        { sponsorshipType: regex },
        { analysisStatus: regex },
        { source: regex },
        { platform: regex },
      ];
    }

    const sort = {
      addedOn: -1 as const,
      publishedDate: -1 as const,
      createdAt: -1 as const,
    };

    const [totalItems, videos] = await Promise.all([
      RawYoutubeVideo.countDocuments(filter),
      RawYoutubeVideo.find(filter)
        .select("-raw")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true)
        .lean(),
    ]);

    const data = videos.map((video: any) => ({
      ...video,
      channelCategory: video.channelCategory || video.category || "",
      category: video.category || video.channelCategory || "",
      productNameWithModel:
        video.productNameWithModel || video.productName || "",
      productName: video.productName || video.productNameWithModel || "",
    }));

    res.json({
      success: true,
      count: data.length,
      data,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getRawYoutubeFoundViaOptions(req: Request, res: Response) {
  try {
    const values = await RawYoutubeVideo.distinct("seedBrandName");

    const data = values
      .map((value: any) => String(value || "").trim())
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}