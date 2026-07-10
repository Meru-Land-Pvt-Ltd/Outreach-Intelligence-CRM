import { Router } from "express";
import {
  exportConversionCsv,
  getSeedSummary
} from "../controllers/reports.controller";

const router = Router();

router.get("/conversion-export", exportConversionCsv);
router.get("/seed-summary", getSeedSummary);

export default router;
