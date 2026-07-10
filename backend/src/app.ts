import express from "express";
import sheetAlignedRoutes from "./routes/sheetAligned.routes";
import cors from "cors";
import { env } from "./config/env";

import healthRoutes from "./routes/health.routes";
import seedBrandRoutes from "./routes/seedBrand.routes";
import jobRoutes from "./routes/job.routes";
import rawYoutubeRoutes from "./routes/rawYoutube.routes";
import brandMapRoutes from "./routes/brandMap.routes";
import contactRoutes from "./routes/contact.routes";
import sheetsRoutes from "./routes/sheets.routes";
import sheetsJobsRoutes from "./routes/sheetsJobs.routes";
import instantlyRoutes from "./routes/instantly.routes";
import reportsRoutes from "./routes/reports.routes";

export const app = express();

app.use(
  cors({
    origin: env.frontendUrls
  })
);

app.use(express.json());

app.use("/api/health", healthRoutes);

app.use("/api", sheetsJobsRoutes);
app.use("/api/seed-brands", seedBrandRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/raw-youtube", rawYoutubeRoutes);
app.use("/api/brand-map", brandMapRoutes);
app.use("/api/contacts", contactRoutes);

app.use("/api/sheets", sheetsRoutes);

app.use("/api/instantly", instantlyRoutes);
app.use("/api/reports", reportsRoutes);

app.use("/api", sheetAlignedRoutes);
