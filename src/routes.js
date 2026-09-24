/**
 * @file The single place that decides which routers are mounted where.
 * `index.js` calls `mountRoutes(app)`; each role folder exposes its own
 * `mount…Routes(app)` from its `index.js`.
 *
 * @remarks
 * The API URLs are exactly what they were before the code was regrouped by
 * role, so the deployed frontend needs no change. Several role folders mount
 * onto the same URL prefix (for example `/api/courses` is served by the admin,
 * lecturer and shared routers). That is safe because their paths don't
 * overlap: an unmatched request simply falls through to the next router.
 *
 * `/api/courses`, `/api/department` and `/api/faculty` require a logged-in
 * user for every route, so `requireAuth` is applied to those prefixes once
 * here rather than once per role mount.
 */
import { requireAuth } from "./auth/authMiddleware.js";
import { mountAuthRoutes } from "./auth/index.js";
import { mountAdminRoutes } from "./admin/index.js";
import { mountLecturerRoutes } from "./lecturer/index.js";
import { mountStudentRoutes } from "./student/index.js";
import { mountSharedRoutes } from "./shared/index.js";

/**
 * Mounts every API router on the Express app.
 *
 * @param {import("express").Express} app - The app to mount onto.
 */
export function mountRoutes(app) {
  app.use(["/api/courses", "/api/department", "/api/faculty"], requireAuth);

  mountAuthRoutes(app);
  mountAdminRoutes(app);
  mountLecturerRoutes(app);
  mountStudentRoutes(app);
  mountSharedRoutes(app);
}
