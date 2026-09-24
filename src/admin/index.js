/**
 * @file Mounts every endpoint that only an Admin may call: user management,
 * and the create/update/delete side of faculties, departments, courses,
 * venues, academic sessions, and institution settings.
 *
 * @remarks
 * The read side of that reference data (listing faculties, `GET /api/settings/current`,
 * and so on) is open to every logged-in user and lives in `src/shared/`, mounted
 * on the same URLs. Business logic for these features also lives in
 * `src/shared/<feature>/` because the read and write endpoints share it; this
 * folder holds only the Admin-guarded routes and their controllers.
 *
 * Faculty, department and course writes are Admin-guarded here with
 * `requireRole("Admin")`. They used to be open to any logged-in user; the
 * authentication itself (`requireAuth`) is applied once for those URL prefixes
 * in `src/routes.js`.
 */
import adminUserRoutes from "./users/adminUserRoutes.js";
import adminCourseRoutes from "./courses/courseRoutes.js";
import adminDepartmentRoutes from "./departments/departmentRoutes.js";
import adminFacultyRoutes from "./faculties/facultyRoutes.js";
import adminVenueRoutes from "./venues/venueRoutes.js";
import adminAcademicSessionRoutes from "./academic-sessions/academicSessionRoutes.js";
import adminSystemSettingsRoutes from "./system-settings/systemSettingsRoutes.js";

/**
 * Registers the Admin-only routes on the Express app.
 *
 * @param {import("express").Express} app - The app to mount onto.
 */
export function mountAdminRoutes(app) {
  app.use("/api/admin", adminUserRoutes);
  app.use("/api/courses", adminCourseRoutes);
  app.use("/api/department", adminDepartmentRoutes);
  app.use("/api/faculty", adminFacultyRoutes);
  app.use("/api/venues", adminVenueRoutes);
  app.use("/api/academic-sessions", adminAcademicSessionRoutes);
  app.use("/api/settings", adminSystemSettingsRoutes);
}
