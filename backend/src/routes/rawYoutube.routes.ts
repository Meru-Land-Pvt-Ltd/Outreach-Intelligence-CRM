import { Router } from "express";
import { getRawYoutubeVideos } from "../controllers/rawYoutube.controller";

const router = Router();

router.get("/", getRawYoutubeVideos);

export default router;
