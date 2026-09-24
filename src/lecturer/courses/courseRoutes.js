/**
 * @file Lecturer endpoints for their own courses and each course's attendance stats.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import express from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getMyCourses, getMyCourseStats } from "./courseController.js";

const router = express.Router();

/**
 * @swagger
 * /courses/mine:
 *   get:
 *     summary: Get courses assigned to the logged-in lecturer
 *     description: >
 *       Each course carries its owning department as
 *       `departments: { name }` (null when it has none).
 *     tags: [Courses]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of courses assigned to the authenticated lecturer
 *       401:
 *         description: Not authenticated
 */
router.get("/mine", requireAuth, getMyCourses);

/**
 * @swagger
 * /courses/mine/stats:
 *   get:
 *     summary: Enrolment size, semester attendance and weekly trend for each of the logged-in lecturer's courses
 *     description: >
 *       Attendance is each ENROLLED student's present/late count divided by
 *       the admin-set expected classes per semester (capped at 100%),
 *       averaged across the course's enrolled students. Only sessions in
 *       the current academic session that ran for at least half their
 *       scheduled length count. Trend is the change against 7 days ago.
 *
 *       Also returns the exam-eligibility numbers. `min_classes_for_exam` is
 *       the fewest attended classes that reach the institution's minimum
 *       attendance percentage. `students_at_risk` counts enrolled students
 *       who can no longer reach it, even if they attend every class still to
 *       come in the semester.
 *     tags: [Courses]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: One stats row per course the lecturer teaches
 *       403:
 *         description: Not a Lecturer
 */
router.get("/mine/stats", requireAuth, requireRole("Lecturer"), getMyCourseStats);

export default router;
