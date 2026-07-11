import { Router } from "express";
import {
  getRawYoutubeVideos,
  getRawYoutubeFoundViaOptions
} from "../controllers/rawYoutube.controller";

const router = Router();

router.get("/", getRawYoutubeVideos);
router.get("/found-via", getRawYoutubeFoundViaOptions);

export default router;
