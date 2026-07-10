import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";

const router = Router();

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;
