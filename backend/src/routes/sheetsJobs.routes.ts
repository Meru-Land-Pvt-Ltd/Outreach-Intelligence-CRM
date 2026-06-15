import { Router } from "express";
import {
  createClosedDeal,
  getActiveIntelligenceJobs,
  getClosedDeals,
  getIntelligenceJobHistory,
  pauseIntelligenceJob,
  resumeIntelligenceJob,
  runIntelligenceJob,
  stopIntelligenceJob
} from "../controllers/sheetsJobs.controller";

const router = Router();

router.get("/sheets/closed-deals", getClosedDeals);
router.post("/sheets/closed-deals", createClosedDeal);

router.post("/jobs/run-intelligence/:seedBrandId", runIntelligenceJob);
router.post("/jobs/intelligence/:jobId/pause", pauseIntelligenceJob);
router.post("/jobs/intelligence/:jobId/resume", resumeIntelligenceJob);
router.post("/jobs/intelligence/:jobId/stop", stopIntelligenceJob);

router.get("/jobs/intelligence/active", getActiveIntelligenceJobs);
router.get("/jobs/intelligence/history", getIntelligenceJobHistory);

export default router;
