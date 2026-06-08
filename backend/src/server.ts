import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import sheetsJobsRoutes from "./routes/sheetsJobs.routes";
import authRoutes from "./routes/auth.routes";
import reviewsRoutes from "./routes/reviews.routes";

async function startServer() {
  await connectDatabase();

  app.use("/api/reviews", reviewsRoutes);
app.use("/api/auth", authRoutes);
app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Backend failed to start", error);
  process.exit(1);
});

app.use("/api", sheetsJobsRoutes);
app.use(sheetsJobsRoutes);
