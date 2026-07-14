import { Router } from "express";
import { getBillingStatus } from "../controllers/billing.controller";

const router = Router();

router.get("/status", getBillingStatus);

export default router;
