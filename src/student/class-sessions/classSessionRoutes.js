/**
 * @file Student endpoint for finding the live sessions of their own courses.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { getActiveSessionsAsStudent } from "./classSessionController.js";

const classSessionRoutes = Router();

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
