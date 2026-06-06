import { Router } from "express";
import {
  batchPushCampaigns,
  exportInstantlyLeads,
  fillCompetitors,
  getBounceEvents,
  getImportedLeads,
  getInstantlyCampaigns,
  getInstantlyLeads,
  getPushLogs,
  getSenders,
  getTemplatePreview,
  getTemplates,
  instantlyWebhook,
  pullBouncedFromInstantly,
  pushToInstantly,
  saveTemplate
} from "../controllers/instantly.controller";

const router = Router();

router.get("/leads", getInstantlyLeads);
router.get("/senders", getSenders);
router.get("/imported-leads", getImportedLeads);
router.get("/template-preview", getTemplatePreview);
router.post("/export", exportInstantlyLeads);

router.get("/templates", getTemplates);
router.post("/templates", saveTemplate);

router.post("/competitors/fill", fillCompetitors);

router.post("/push", pushToInstantly);

/**
 * Main old-sheet compatible batch route.
 */
router.post("/batch-push", batchPushCampaigns);

/**
 * Alias because frontend/control-panel may call /batch.
 */
router.post("/batch", batchPushCampaigns);

router.get("/campaigns", getInstantlyCampaigns);
router.get("/push-logs", getPushLogs);

router.get("/bounces", getBounceEvents);

/**
 * Main old-sheet compatible bounced route.
 */
router.post("/pull-bounced", pullBouncedFromInstantly);

/**
 * Alias because frontend/control-panel may call /bounces/pull.
 */
router.post("/bounces/pull", pullBouncedFromInstantly);

router.post("/webhook", instantlyWebhook);

export default router;
