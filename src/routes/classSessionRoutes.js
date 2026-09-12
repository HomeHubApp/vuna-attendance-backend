import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { startSession, endSession, getActiveSessions } from "../controllers/classSessionController.js";

const classSessionRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Class Sessions
 *   description: Live class session lifecycle — start, end, and active-session lookup
 */

/**
 * @swagger
 * /class-sessions/start:
 *   post:
 *     summary: Start (or resume) today's live session for a class schedule
 *     tags: [Class Sessions]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [class_schedule_id, latitude, longitude]
 *             properties:
 *               class_schedule_id: { type: string, format: uuid }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               accuracy: { type: number, description: "GPS accuracy in meters, from the Geolocation API" }
 *     responses:
 *       201:
 *         description: Session started. May include a non-blocking `warning` if venue_verified is false.
 *       400:
 *         description: Wrong day, outside effective date range, missing venue, or accuracy too poor
 *       403:
 *         description: Not assigned to this course
 *       404:
 *         description: Schedule not found
 *       409:
 *         description: Session already active or already ended for today
 */
classSessionRoutes.post("/start", requireAuth, requireRole("Lecturer"), startSession);

/**
 * @swagger
 * /class-sessions/{id}/end:
 *   post:
 *     summary: End an active session
 *     tags: [Class Sessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session ended
 *       403:
 *         description: You did not start this session
 *       404:
 *         description: Session not found
 *       409:
 *         description: Session is not currently active
 */
classSessionRoutes.post("/:id/end", requireAuth, requireRole("Lecturer"), endSession);

/**
 * @swagger
 * /class-sessions/active:
 *   get:
 *     summary: Get the logged-in lecturer's currently active sessions
 *     tags: [Class Sessions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions for this lecturer
 */
classSessionRoutes.get("/active", requireAuth, requireRole("Lecturer"), getActiveSessions);

export default classSessionRoutes;