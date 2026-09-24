/**
 * @file Lecturer-only route for the Class Attendance Record ("roster")
 * page. Mounted at the same `/api/courses` prefix as
 * `lecturer/courses/courseRoutes.js` (its own `/mine`, `/mine/stats`) —
 * safe because `/:courseId/roster` never overlaps those literal paths.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getRoster } from "./rosterController.js";

const rosterRoutes = Router();

/**
 * @swagger
 * /courses/{courseId}/roster:
 *   get:
 *     summary: The Class Attendance Record for one course, resolved to one occurrence
 *     description: >
 *       Resolves to the exact class occurrence given by scheduleId + date
 *       (both required together — e.g. arriving from the Timetable's "View
 *       Attendance" action), or, when neither is given, to the course's
 *       most recently held session. `state` in the response is
 *       "held" (a session ran — full roster data included),
 *       "not_held" (that scheduled occurrence never ran — only course +
 *       schedule facts are included), or "no_sessions_yet" (the course has
 *       never held a session at all).
 *     tags: [Roster]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: scheduleId
 *         schema: { type: string, format: uuid }
 *         description: class_schedule.id — required together with date.
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: YYYY-MM-DD — required together with scheduleId.
 *     responses:
 *       200:
 *         description: The resolved roster
 *       400:
 *         description: scheduleId/date given without the other, or date isn't a real occurrence of that schedule
 *       403:
 *         description: You do not teach this course
 *       404:
 *         description: Course or class schedule row not found
 */
rosterRoutes.get("/:courseId/roster", requireAuth, requireRole("Lecturer"), getRoster);

export default rosterRoutes;
