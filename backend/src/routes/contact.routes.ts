import { Router } from "express";
import { getContacts } from "../controllers/contact.controller";

const router = Router();

router.get("/", getContacts);

export default router;
