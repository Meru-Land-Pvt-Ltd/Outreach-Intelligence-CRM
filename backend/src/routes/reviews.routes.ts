import { Router } from "express";
import { getReviews, syncReviews } from "../controllers/reviews.controller";

const router = Router();

router.get("/:channel", getReviews);
router.post("/sync/:channel", syncReviews);

export default router;
