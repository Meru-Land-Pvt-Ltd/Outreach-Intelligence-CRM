import { Router } from "express";
import {
  getClosedDeals,
  createClosedDeal,
  getExcludedBrands,
  createExcludedBrand,
  deleteExcludedBrand,
  restoreExcludedBrand,
  getPipelineTracker,
  getNicheAnalysis
} from "../controllers/sheets.controller";

const router = Router();

router.get("/closed-deals", getClosedDeals);
router.post("/closed-deals", createClosedDeal);

router.get("/excluded-brands", getExcludedBrands);
router.post("/excluded-brands", createExcludedBrand);
router.post("/excluded-brands/:id/restore", restoreExcludedBrand);
router.delete("/excluded-brands/:id", deleteExcludedBrand);

router.get("/pipeline-tracker", getPipelineTracker);
router.get("/niche-analysis", getNicheAnalysis);

export default router;
