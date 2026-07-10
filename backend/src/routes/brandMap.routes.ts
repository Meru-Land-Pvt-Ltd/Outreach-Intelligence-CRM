import { Router } from "express";
import {
  getBrandMap,
  rebuildBrandMap,
  rebuildAllBrandMaps,
  selectBrandMapRows,
  excludeBrandMapRows,
  pushBrandMapRowsToInstantly,
  discoverEmailsForBrandMapRows,
  discoverBrandIntent
} from "../controllers/brandMap.controller";

const router = Router();

router.get("/", getBrandMap);
router.post("/rebuild-all", rebuildAllBrandMaps);
router.post("/rebuild/:seedBrandId", rebuildBrandMap);

router.post("/select", selectBrandMapRows);
router.post("/exclude", excludeBrandMapRows);
router.post("/push-instantly", pushBrandMapRowsToInstantly);
router.post("/discover-emails", discoverEmailsForBrandMapRows);
router.post("/:id/discover-intent", discoverBrandIntent);

export default router;
