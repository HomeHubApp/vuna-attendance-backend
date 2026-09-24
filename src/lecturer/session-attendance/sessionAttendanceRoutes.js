/**
 * @file Lecturer endpoint for seeing who joined a session they started.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getSessionAttendance, overrideAttendance } from "./sessionAttendanceController.js";

const sessionAttendanceRoutes = Router();

/**
 * @swagger
 * /session-attendance/{id}:
 *   get:
 *     summary: Lecturer views attendance for a session they started
 *     tags: [Session Attendance]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: class_sessions.id
 *     responses:
 *       200:
 *         description: List of students' attendance for this session
 *       403:
 *         description: You did not start this session
 *       404:
 *         description: Session not found
 */
sessionAttendanceRoutes.get("/:id", requireAuth, requireRole("Lecturer"), getSessionAttendance);

/**
 * @swagger
 * /session-attendance/{id}/override/{studentId}:
 *   patch:
 *     summary: Lecturer manually overrides a student's attendance status for a session they started
 *     description: >
 *       Creates the session_attendance row if the student never joined at
 *       all (e.g. a physical register confirms they were present), or
 *       updates it if one exists. The reason is permanently attributed to
 *       the acting lecturer and never cleared.
 *     tags: [Session Attendance]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: class_sessions.id
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, reason]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PRESENT, LATE, FLAGGED, ABSENT, LEFT_EARLY]
 *               reason:
 *                 type: string
 *                 description: At least 20 characters.
 *     responses:
 *       200:
 *         description: The resulting session_attendance row
 *       400:
 *         description: Invalid status, or reason under 20 characters
 *       403:
 *         description: You did not start this session
 *       404:
 *         description: Session not found, or the student is not enrolled in its course
 */
sessionAttendanceRoutes.patch("/:id/override/:studentId", requireAuth, requireRole("Lecturer"), overrideAttendance);

export default sessionAttendanceRoutes;
