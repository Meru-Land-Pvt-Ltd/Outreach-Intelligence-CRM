import express from "express";
import sheetAlignedRoutes from "./routes/sheetAligned.routes";
import cors from "cors";
import { env } from "./config/env";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import seedBrandRoutes from "./routes/seedBrand.routes";
import jobRoutes from "./routes/job.routes";
import rawYoutubeRoutes from "./routes/rawYoutube.routes";
import brandMapRoutes from "./routes/brandMap.routes";
import contactRoutes from "./routes/contact.routes";
import sheetsRoutes from "./routes/sheets.routes";
import sheetsJobsRoutes from "./routes/sheetsJobs.routes";
import instantlyRoutes from "./routes/instantly.routes";
import reviewsRoutes from "./routes/reviews.routes";
import settingsRoutes from "./routes/settings.routes";
import { requireAuth } from "./controllers/auth.controller";
import { instantlyWebhook } from "./controllers/instantly.controller";

export const app = express();

app.use(
  cors({
    origin: env.frontendUrls
  })
);

app.use(express.json());

// Open endpoints: health checks, login, and the Instantly webhook
// (the webhook is guarded by INSTANTLY_WEBHOOK_SECRET inside the handler).
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.post("/api/instantly/webhook", instantlyWebhook);

// Everything below requires a valid session token.
app.use("/api", requireAuth);

app.use("/api", sheetsJobsRoutes);
app.use("/api/seed-brands", seedBrandRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/raw-youtube", rawYoutubeRoutes);
app.use("/api/brand-map", brandMapRoutes);
app.use("/api/contacts", contactRoutes);

app.use("/api/sheets", sheetsRoutes);

app.use("/api/instantly", instantlyRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/settings", settingsRoutes);

app.use("/api", sheetAlignedRoutes);
