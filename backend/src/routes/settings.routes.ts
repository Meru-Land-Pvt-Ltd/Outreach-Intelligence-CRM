import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import {
  getAiSettings,
  listAiModels,
  saveAiSettings
} from "../controllers/aiSettings.controller";

const router = Router();

router.get("/ai", getAiSettings);
router.put("/ai", saveAiSettings);
router.post("/ai/models", listAiModels);

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;
