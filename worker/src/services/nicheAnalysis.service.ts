import { BrandMap } from "../models/BrandMap.model";
import { NicheAnalysis } from "../models/NicheAnalysis.model";

export async function rebuildNicheAnalysis() {
  const result = await BrandMap.aggregate([
    {
      $match: {
        niche: {
          $exists: true,
          $nin: ["", null, "-", "N/A", "None"]
        }
      }
    },
    {
      $group: {
        _id: "$niche",
        brandCount: {
          $sum: 1
        }
      }
    }
  ]);

  await NicheAnalysis.deleteMany({});

  for (const item of result) {
    await NicheAnalysis.create({
      nicheName: item._id,
      brandCount: item.brandCount
    });
  }

  return {
    nicheCount: result.length
  };
}
