import { Router } from "express";
import {
  batchPushCampaigns,
  exportInstantlyLeads,
  fillCompetitors,
  getBounceEvents,
  getImportedLeads,
  getInstantlyCampaigns,
  getInstantlyExportStatus,
  getInstantlyLeads,
  getPushLogs,
  getSenders,
  getTemplatePreview,
  getTemplates,
  instantlyWebhook,
  pullBouncedFromInstantly,
  pushToInstantly,
  resetOldPushedLeads,
  saveTemplate,
  verifyPendingInstantlyLeads
} from "../controllers/instantly.controller";

const router = Router();

router.post("/fill-competitors", fillCompetitors);

router.get("/leads", getInstantlyLeads);
router.get("/senders", getSenders);
router.get("/imported-leads", getImportedLeads);
router.get("/template-preview", getTemplatePreview);

router.post("/export", exportInstantlyLeads);
router.get("/export/status/:jobId", getInstantlyExportStatus);

router.post("/reset-pushed", resetOldPushedLeads);

router.get("/templates", getTemplates);
router.post("/templates", saveTemplate);

router.post("/competitors/fill", fillCompetitors);

router.post("/verify-pending", verifyPendingInstantlyLeads);
router.post("/verification/run", verifyPendingInstantlyLeads);

router.post("/push", pushToInstantly);

router.post("/batch-push", batchPushCampaigns);

router.post("/batch", batchPushCampaigns);

router.get("/campaigns", getInstantlyCampaigns);
router.get("/push-logs", getPushLogs);

router.get("/bounces", getBounceEvents);

router.post("/pull-bounced", pullBouncedFromInstantly);

router.post("/bounces/pull", pullBouncedFromInstantly);

router.post("/webhook", instantlyWebhook);

export default router;
