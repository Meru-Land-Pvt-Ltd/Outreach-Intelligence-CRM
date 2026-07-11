import { Router } from "express";
import {
  getBrandMap,
  rebuildBrandMap,
  rebuildAllBrandMaps,
  bulkSelectBrands,
  processSelectedBrands,
  scrapeBrandWebsite,
  findBrandPga,
  runBulkPga,
  getBulkPgaStatus
} from "../controllers/brandMap.controller";

const router = Router();

router.get("/", getBrandMap);
router.post("/bulk-select", bulkSelectBrands);
router.post("/process-selected", processSelectedBrands);
router.post("/pga-bulk", runBulkPga);
router.get("/pga-bulk/:jobId", getBulkPgaStatus);
router.post("/rebuild-all", rebuildAllBrandMaps);
router.post("/rebuild/:seedBrandId", rebuildBrandMap);
router.post("/:id/scrape", scrapeBrandWebsite);
router.post("/:id/pga", findBrandPga);

export default router;
