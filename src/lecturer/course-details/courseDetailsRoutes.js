/**
 * @file Lecturer-only routes for the Course Details page, all under
 * `/api/course-details` (mounted by `lecturer/index.js`). Each takes the same
 * optional `?courseId=` and defaults to the lecturer's first course by code
 * when it's omitted. The page is loaded in parts, one endpoint each, so each
 * can have its own loading state: `/overview` (header + stat cards) today; the
 * attendance matrix gets its own route when that section is built.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getOverview } from "./courseDetailsController.js";

const courseDetailsRoutes = Router();

/**
 * @swagger
 * /course-details/overview:
 *   get:
 *     summary: The Course Details page's header and stat cards for one of the lecturer's courses
 *     description: >
 *       Returns the options for the course dropdown (every course the
 *       lecturer teaches, sorted by code), the selected course's header, and
 *       the three stat cards. `course` (the header) has the department,
 *       units, enrolled students, weekly timetable pattern, the current
 *       session, classes held this term, the exam rule (minimum classes and
 *       percentage) and average attendance. `stats` has `totalStudents`
 *       (enrolled), `studentsAtRisk` (enrolled students who can no longer
 *       reach the exam minimum even by attending every class still to come)
 *       and `avgAttendancePercentage` (the same figure the header shows).
 *       `course` and `stats` are null only when the lecturer teaches no
 *       courses. `avgAttendancePercentage` is null when there is nothing to
 *       average yet (no enrolled students, or no class held). `scheduleSlots`
 *       is empty when the course has no active recurring timetable row —
 *       Fixed Classes aren't part of the weekly pattern.
 *     tags: [Course Details]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema: { type: string, format: uuid }
 *         description: The course to show. Omit for the lecturer's first course by code.
 *     responses:
 *       200:
 *         description: The dropdown options, the selected course's header, and its stat cards
 *       403:
 *         description: Not a Lecturer
 *       404:
 *         description: courseId isn't one of the lecturer's courses
 */
courseDetailsRoutes.get("/overview", requireAuth, requireRole("Lecturer"), getOverview);

export default courseDetailsRoutes;
