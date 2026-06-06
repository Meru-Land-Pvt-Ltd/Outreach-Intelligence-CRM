import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import sheetsJobsRoutes from "./routes/sheetsJobs.routes";

async function startServer() {
  await connectDatabase();

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