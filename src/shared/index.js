/**
 * @file Mounts the endpoints any logged-in user may call, regardless of role:
 * notifications, plus the read-only side of reference data (courses, faculties,
 * departments, venues, academic sessions, and `GET /api/settings/current`).
 *
 * @remarks
 * `src/shared/` also holds the business logic that more than one role folder
 * calls — for example `class-schedule/classScheduleService.js` is used by both
 * the lecturer's and the student's class-schedule endpoints, and every
 * reference-data service is used by both its Admin write routes and its
 * shared read routes here. Pure attendance maths is in `analytics/`.
 *
 * Rule of thumb: an endpoint lives in the folder of the role allowed to call
 * it (or here when every role may); a service lives beside its only caller, or
 * here when two or more folders use it.
 */
import notificationRoutes from "./notifications/notificationRoutes.js";
import courseReadRoutes from "./courses/courseRoutes.js";
import departmentReadRoutes from "./departments/departmentRoutes.js";
import facultyReadRoutes from "./faculties/facultyRoutes.js";
import venueReadRoutes from "./venues/venueRoutes.js";
import academicSessionReadRoutes from "./academic-sessions/academicSessionRoutes.js";
import systemSettingsReadRoutes from "./system-settings/systemSettingsRoutes.js";

/**
 * Registers the routes open to every logged-in user on the Express app.
 *
 * @param {import("express").Express} app - The app to mount onto.
 */
export function mountSharedRoutes(app) {
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/courses", courseReadRoutes);
  app.use("/api/department", departmentReadRoutes);
  app.use("/api/faculty", facultyReadRoutes);
  app.use("/api/venues", venueReadRoutes);
  app.use("/api/academic-sessions", academicSessionReadRoutes);
  app.use("/api/settings", systemSettingsReadRoutes);
}
