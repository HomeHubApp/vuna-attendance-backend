/**
 * @file Lecturer-only route for the Dashboard, `/api/lecturer-dashboard`
 * (mounted by `lecturer/index.js`). One endpoint returns every section of the
 * page — see `dashboardService.js` for why, and for what to do if it gets slow.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getDashboard } from "./dashboardController.js";

const dashboardRoutes = Router();

/**
 * @swagger
 * /lecturer-dashboard:
 *   get:
 *     summary: Everything the lecturer Dashboard shows, in one response
 *     description: >
 *       `lecturer` (name, department), `today` (the date in Nigeria, UTC+1),
 *       `stats` (classes today and how many are live, courses taught, records
 *       awaiting review, and average attendance with its change over the past
 *       week, in percentage points), `schedule` (today's classes in time order,
 *       each `live`, `completed`, `missed` — never started and past its end —
 *       or `upcoming`, with `progress` while live), `reviewQueue` (the newest
 *       20 Flagged or Incomplete records not yet ruled on, with the
 *       verification `issues` behind each), `weeklyAttendance` (the last 12
 *       teaching weeks: each course's share of enrolled students attending),
 *       and `courses` (per course: enrolled, attendance percent, classes held
 *       versus expected, and students at risk — those who can no longer reach
 *       the exam minimum). The numbers use the same rules as the Courses page,
 *       Course Details and the roster. A lecturer with no courses gets the same
 *       shape, empty.
 *     tags: [Lecturer Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The dashboard
 *       403:
 *         description: Not a Lecturer
 */
dashboardRoutes.get("/", requireAuth, requireRole("Lecturer"), getDashboard);

export default dashboardRoutes;
