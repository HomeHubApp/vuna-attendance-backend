/**
 * @file Lecturer-only routes for the Course Details page, all under
 * `/api/course-details` (mounted by `lecturer/index.js`). The page is loaded
 * in parts, one endpoint each, so each can have its own loading state:
 * `/overview` (header + stat cards; `?courseId=` optional, defaulting to the
 * lecturer's first course by code) and `/attendance-matrix` (the
 * student-by-session table; `?courseId=` required, so it can never describe a
 * different course from the header it sits under).
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getAttendanceMatrix, getOverview } from "./courseDetailsController.js";

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

/**
 * @swagger
 * /course-details/attendance-matrix:
 *   get:
 *     summary: The Course Details page's attendance table (a row per student, a column per held session) for one of the lecturer's courses
 *     description: >
 *       `sessions` are the classes held this term (ended and run for at least
 *       half their scheduled length), oldest first, each with its ISO `date`
 *       and teaching `weekNumber` (counted from the academic session's start
 *       date; null when it has none). `students` lists every ENROLLED student,
 *       sorted by name; each has `attendance` (one status per session, in the
 *       same order: present, incomplete, absent or flagged — the same buckets
 *       the Class Attendance Record shows), `attendancePercent` (attended ÷
 *       the semester's expected classes, capped at 100) and `eligibility`:
 *       ELIGIBLE (already attended the minimum), IN_PROGRESS (not yet, but
 *       still can), or AT_RISK (can no longer reach it even by attending every
 *       class still to come — the same test as `studentsAtRisk` in
 *       /course-details/overview). `rules` carries the exam minimum the
 *       percentages are judged against. `sessions` is empty until a class has
 *       been held.
 *     tags: [Course Details]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The course to show.
 *     responses:
 *       200:
 *         description: The course's attendance matrix
 *       400:
 *         description: courseId is missing
 *       403:
 *         description: Not a Lecturer
 *       404:
 *         description: courseId isn't one of the lecturer's courses
 */
courseDetailsRoutes.get("/attendance-matrix", requireAuth, requireRole("Lecturer"), getAttendanceMatrix);

export default courseDetailsRoutes;
