import { Router } from "express";
import {
  getEmailDiscoveryRows,
  getHunterRawContacts,
  getApolloRawContacts,
  getProspeoRawContacts,
  getEnoylityInstantlyRows,
  getMhdInstantlyRows,
  getEnoylityTemplateRows,
  getMhdTemplateRows,
  getPushLogRows,
  getRunLogRows,
  getEnoylityReviews,
  getMhdReviews
} from "../controllers/sheetAligned.controller";

const router = Router();

router.get("/email-discovery", getEmailDiscoveryRows);
router.get("/email-discovery/hunter-raw", getHunterRawContacts);
router.get("/email-discovery/apollo-raw", getApolloRawContacts);
router.get("/email-discovery/prospeo-raw", getProspeoRawContacts);

router.get("/instantly/enoylity", getEnoylityInstantlyRows);
router.get("/instantly/mhd", getMhdInstantlyRows);
router.get("/instantly/templates/enoylity", getEnoylityTemplateRows);
router.get("/instantly/templates/mhd", getMhdTemplateRows);
router.get("/instantly/push-log", getPushLogRows);

router.get("/run-log", getRunLogRows);

router.get("/reviews/enoylity", getEnoylityReviews);
router.get("/reviews/mhd", getMhdReviews);

export default router;
