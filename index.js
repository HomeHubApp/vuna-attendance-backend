import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./src/auth/authRoutes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/config/swagger.js";

import courseroutes from "./src/courses/coursesroutes.js";
import { requireAuth } from "./src/auth/authMiddleware.js";
import departmentroutes from "./src/academic-structure/departmentRoutes.js"
import Facultyroutes from "./src/academic-structure/facultyroutes.js"

import { startAutoEndSessionsJob } from "./src/live-sessions/jobs/autoEndSessions.js";
import { startMissedCheckInMonitorJob } from "./src/live-sessions/jobs/missedCheckInMonitor.js";



import adminRoutes from "./src/admin/adminRoutes.js";
import classScheduleRoutes from "./src/class-schedule/classScheduleRoutes.js";
import notificationRoutes from "./src/notifications/notificationRoutes.js";
import systemSettingsRoutes from "./src/system-settings/systemSettingsRoutes.js";
import academicSessionRoutes from "./src/academic-structure/academicSessionRoutes.js";
import venueRoutes from "./src/venues/venueRoutes.js";
import classSessionRoutes from "./src/live-sessions/classSessionRoutes.js";
import sessionAttendanceRoutes from "./src/live-sessions/sessionAttendanceRoutes.js";
import attendanceCheckRoutes from "./src/live-sessions/attendanceCheckRoutes.js";
import studentCourseRoutes from "./src/student-courses/studentCourseRoutes.js";

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

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/courses",requireAuth, courseroutes)
app.use("/api/department",requireAuth, departmentroutes)
app.use("/api/faculty", requireAuth, Facultyroutes)

app.use("/api/class-schedule", classScheduleRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/settings", systemSettingsRoutes)
app.use("/api/academic-sessions", academicSessionRoutes)
app.use("/api/venues", venueRoutes)
app.use("/api/class-sessions", classSessionRoutes)
app.use("/api/session-attendance", sessionAttendanceRoutes)
app.use("/api/attendance-checks", attendanceCheckRoutes)
app.use("/api/students", studentCourseRoutes)

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
startMissedCheckInMonitorJob();
startAutoEndSessionsJob();
