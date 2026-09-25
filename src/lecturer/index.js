/**
 * @file Mounts every endpoint that only a Lecturer may call: managing their
 * own class schedule, running live class sessions, seeing who joined a
 * session (and overriding it), reading their own courses and attendance
 * stats, and the Class Attendance Record ("roster") for one occurrence of
 * a course, the Course Details page's sections, and the Dashboard.
 *
 * @remarks
 * These share URL prefixes with the student endpoints (for example
 * `/api/class-sessions`): Express tries each mounted router in turn and the
 * paths don't overlap, so the URLs the frontend calls are unchanged. The
 * business logic both roles call (class schedule, class sessions, session
 * attendance, courses) lives in `src/shared/`; the lecturer-only stats
 * service (`courses/courseStatsService.js`), the roster feature
 * (`roster/`) and the Course Details feature (`course-details/`, its own
 * `/api/course-details` prefix, one endpoint per part of the page) and the
 * Dashboard (`dashboard/`, `/api/lecturer-dashboard`, one endpoint for the
 * whole page) live here.
 */
import lecturerClassScheduleRoutes from "./class-schedule/classScheduleRoutes.js";
import lecturerClassSessionRoutes from "./class-sessions/classSessionRoutes.js";
import lecturerSessionAttendanceRoutes from "./session-attendance/sessionAttendanceRoutes.js";
import lecturerCourseRoutes from "./courses/courseRoutes.js";
import lecturerRosterRoutes from "./roster/rosterRoutes.js";
import lecturerCourseDetailsRoutes from "./course-details/courseDetailsRoutes.js";
import lecturerDashboardRoutes from "./dashboard/dashboardRoutes.js";

/**
 * Registers the Lecturer-only routes on the Express app.
 *
 * @param {import("express").Express} app - The app to mount onto.
 */
export function mountLecturerRoutes(app) {
  app.use("/api/class-schedule", lecturerClassScheduleRoutes);
  app.use("/api/class-sessions", lecturerClassSessionRoutes);
  app.use("/api/session-attendance", lecturerSessionAttendanceRoutes);
  app.use("/api/courses", lecturerCourseRoutes);
  app.use("/api/courses", lecturerRosterRoutes);
  app.use("/api/course-details", lecturerCourseDetailsRoutes);
  app.use("/api/lecturer-dashboard", lecturerDashboardRoutes);
}
