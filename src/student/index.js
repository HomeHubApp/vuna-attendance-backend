/**
 * @file Mounts every endpoint that only a Student may call: their own
 * courses and enrolment, their timetable, finding and joining a live class,
 * and the periodic location check-ins.
 *
 * @remarks
 * Some prefixes are shared with the lecturer endpoints (for example
 * `/api/class-sessions`); the paths don't overlap, so the URLs the frontend
 * calls are unchanged. Business logic used by both roles lives in
 * `src/shared/`; the student-only course/enrolment feature
 * (`courses/studentCourseService.js`) lives here.
 */
import studentCourseRoutes from "./courses/studentCourseRoutes.js";
import studentClassScheduleRoutes from "./class-schedule/classScheduleRoutes.js";
import studentClassSessionRoutes from "./class-sessions/classSessionRoutes.js";
import studentSessionAttendanceRoutes from "./session-attendance/sessionAttendanceRoutes.js";
import attendanceCheckRoutes from "./attendance-checks/attendanceCheckRoutes.js";

/**
 * Registers the Student-only routes on the Express app.
 *
 * @param {import("express").Express} app - The app to mount onto.
 */
export function mountStudentRoutes(app) {
  app.use("/api/students", studentCourseRoutes);
  app.use("/api/class-schedule", studentClassScheduleRoutes);
  app.use("/api/class-sessions", studentClassSessionRoutes);
  app.use("/api/session-attendance", studentSessionAttendanceRoutes);
  app.use("/api/attendance-checks", attendanceCheckRoutes);
}
