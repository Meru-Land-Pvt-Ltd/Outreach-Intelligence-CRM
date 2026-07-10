import { Router } from "express";
import {
  getBrandMap,
  rebuildBrandMap,
  rebuildAllBrandMaps,
  bulkSelectBrands,
  processSelectedBrands,
  scrapeBrandWebsite,
  findBrandIntent,
  runBulkIntent,
  getBulkIntentStatus
} from "../controllers/brandMap.controller";

const router = Router();

router.get("/", getBrandMap);
router.post("/bulk-select", bulkSelectBrands);
router.post("/process-selected", processSelectedBrands);
router.post("/intent-bulk", runBulkIntent);
router.get("/intent-bulk/:jobId", getBulkIntentStatus);
router.post("/rebuild-all", rebuildAllBrandMaps);
router.post("/rebuild/:seedBrandId", rebuildBrandMap);
router.post("/:id/scrape", scrapeBrandWebsite);
router.post("/:id/intent", findBrandIntent);

export default router;
