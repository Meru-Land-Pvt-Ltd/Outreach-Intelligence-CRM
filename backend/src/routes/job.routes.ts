import { Router } from "express";
import {
  runIntelligenceJob,
  refreshLatestReviewsJob,
  getJobStatus
} from "../controllers/job.controller";

const router = Router();

router.post("/run-intelligence/:seedBrandId", runIntelligenceJob);
router.post("/refresh-latest-reviews", refreshLatestReviewsJob);
router.get("/:jobId", getJobStatus);

export default router;
