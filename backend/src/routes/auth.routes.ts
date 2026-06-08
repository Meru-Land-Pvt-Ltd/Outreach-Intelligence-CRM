import { Router } from "express";
import { login, me, requireAuth } from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
