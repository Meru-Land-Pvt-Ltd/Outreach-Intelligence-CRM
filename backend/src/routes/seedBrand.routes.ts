import { Router } from "express";
import {
  createSeedBrand,
  getSeedBrands
} from "../controllers/seedBrand.controller";

const router = Router();

router.post("/", createSeedBrand);
router.get("/", getSeedBrands);

export default router;