import { Router } from "express";
import {
  createClosedDeal,
  getActiveIntelligenceJobs,
  getClosedDeals,
  getIntelligenceJobHistory,
  runIntelligenceJob
} from "../controllers/sheetsJobs.controller";

const router = Router();

router.get("/sheets/closed-deals", getClosedDeals);
router.post("/sheets/closed-deals", createClosedDeal);

router.post("/jobs/run-intelligence/:seedBrandId", runIntelligenceJob);

router.get("/jobs/intelligence/active", getActiveIntelligenceJobs);
router.get("/jobs/intelligence/history", getIntelligenceJobHistory);

export default router;
