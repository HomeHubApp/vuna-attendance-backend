/**
 * @file Server entry point: Express setup (JSON, CORS, cookies), the API
 * routes, Swagger docs, the health check, and the background jobs.
 *
 * @remarks
 * Which router serves which URL is decided in `src/routes.js`; the code is
 * grouped by role under `src/auth`, `src/admin`, `src/lecturer`,
 * `src/student` and `src/shared`. Starting the server also starts two cron
 * jobs (auto-end overdue sessions, flag students who miss location checks),
 * so importing this file has side effects — tests and tooling that only need
 * the routes should import `mountRoutes` from `src/routes.js` instead.
 */
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/config/swagger.js";
import { mountRoutes } from "./src/routes.js";
import { startAutoEndSessionsJob } from "./src/jobs/autoEndSessions.js";
import { startMissedCheckInMonitorJob } from "./src/jobs/missedCheckInMonitor.js";

const PORT = process.env.PORT || 8000;
const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://localhost",
        "capacitor://localhost",
        "https://main.d4h1jxr36mgwz.amplifyapp.com"
    ],
    credentials: true,
}));

app.use(cookieParser());

mountRoutes(app);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
startMissedCheckInMonitorJob();
startAutoEndSessionsJob();
