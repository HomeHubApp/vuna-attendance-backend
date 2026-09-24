/**
 * @file Student endpoint for reading the timetable of the courses they are enrolled in.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getMyScheduleAsStudent } from "./classScheduleController.js";

const classScheduleRoutes = Router();

/**
 * @swagger
 * /class-schedule/mine/student:
 *   get:
 *     summary: Get the logged-in student's full recurring timetable, for courses matching their department + level
 *     tags: [Class Schedule]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All active schedule rows for courses matching this student's department + level (same basis GET /enrollments/eligible-courses uses)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClassSchedule'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a Student
 *       404:
 *         description: Student record not found
 */
classScheduleRoutes.get("/mine/student", requireAuth, requireRole("Student"), getMyScheduleAsStudent);

export default classScheduleRoutes;
