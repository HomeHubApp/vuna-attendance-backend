import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { joinSession, getSessionAttendance } from "../controllers/sessionAttendanceController.js";
import rateLimit from "express-rate-limit";

const sessionAttendanceRoutes = Router();
const joinSessionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.authUser?.id || req.ip,
    message: { error: "Too many join attempts. Please slow down." },
});

/**
 * @swagger
 * tags:
 *   name: Session Attendance
 *   description: Student join-in and lecturer attendance view for live class sessions
 */

/**
 * @swagger
 * /session-attendance/{id}/join:
 *   post:
 *     summary: Student joins an active class session
 *     tags: [Session Attendance]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: class_sessions.id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               device_id: { type: string }
 *     responses:
 *       201:
 *         description: Joined successfully (or already joined — idempotent)
 *       400:
 *         description: Session is not currently active
 *       403:
 *         description: Not enrolled in this course
 *       404:
 *         description: Session not found
 */
sessionAttendanceRoutes.post("/:id/join", requireAuth, requireRole("Student"), joinSessionLimiter, joinSession);

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

export default sessionAttendanceRoutes;