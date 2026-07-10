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

  // Upsert per niche instead of wipe-and-recreate, so readers never see an
  // empty table mid-rebuild (and concurrent rebuilds stay consistent).
  const nicheNames: string[] = [];

  for (const item of result) {
    nicheNames.push(item._id);

    await NicheAnalysis.findOneAndUpdate(
      { nicheName: item._id },
      {
        $set: {
          brandCount: item.brandCount
        }
      },
      { upsert: true }
    );
  }

  await NicheAnalysis.deleteMany({
    nicheName: { $nin: nicheNames }
  });

  return {
    nicheCount: result.length
  };
}
