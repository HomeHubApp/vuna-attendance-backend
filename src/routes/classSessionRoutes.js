import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  startSession,
  endSession,
  getActiveSessions,
  getMySessions,
  getActiveSessionsAsStudent,
} from "../controllers/classSessionController.js";

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
 *         description: Wrong day, outside effective date range, missing venue, scheduled start time not reached yet, or accuracy too poor
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

/**
 * @swagger
 * /class-sessions/mine:
 *   get:
 *     summary: Get the logged-in lecturer's sessions (active and ended), newest first
 *     tags: [Class Sessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Earliest session_date (inclusive)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Latest session_date (inclusive)
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, ENDED] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 200, maximum: 500 }
 *     responses:
 *       200:
 *         description: The lecturer's sessions
 *       400:
 *         description: Invalid filter
 */
classSessionRoutes.get("/mine", requireAuth, requireRole("Lecturer"), getMySessions);

/**
 * @swagger
 * /class-sessions/active/student:
 *   get:
 *     summary: Get currently active sessions for courses matching the logged-in student's department + level
 *     tags: [Class Sessions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions for this student's eligible courses
 *       404:
 *         description: Student record not found
 */
classSessionRoutes.get("/active/student", requireAuth, requireRole("Student"), getActiveSessionsAsStudent);

export default classSessionRoutes;