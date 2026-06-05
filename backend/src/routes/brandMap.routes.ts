import { Router } from "express";
import {
  getBrandMap,
  rebuildBrandMap,
  rebuildAllBrandMaps
} from "../controllers/brandMap.controller";

const router = Router();

router.get("/", getBrandMap);
router.post("/rebuild-all", rebuildAllBrandMaps);
router.post("/rebuild/:seedBrandId", rebuildBrandMap);

export default router;
