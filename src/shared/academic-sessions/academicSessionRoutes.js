/**
 * @file Read-only list of academic sessions, open to every logged-in user.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth } from "../../auth/authMiddleware.js";
import { getAcademicSessions } from "./academicSessionController.js";

const academicSessionRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Academic Sessions
 *   description: The university's academic session (school year) history — feeds the Academic Session picker on Settings. No delete route exists; once created, a session is permanent.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AcademicSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "2025/2026"
 *         start_date:
 *           type: string
 *           format: date
 *           nullable: true
 *         end_date:
 *           type: string
 *           format: date
 *           nullable: true
 *         created_by:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         created_at:
 *           type: string
 *         updated_at:
 *           type: string
 *
 *     AcademicSessionInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: "2026/2027"
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2026-09-01"
 *         end_date:
 *           type: string
 *           format: date
 *           example: "2027-07-31"
 *
 *     AcademicSessionUpdateInput:
 *       type: object
 *       description: Every field is optional — only send what changed
 *       properties:
 *         name:
 *           type: string
 *           example: "2026/2027"
 *         start_date:
 *           type: string
 *           format: date
 *         end_date:
 *           type: string
 *           format: date
 */

/**
 * @swagger
 * /academic-sessions:
 *   get:
 *     summary: List all academic sessions
 *     tags: [Academic Sessions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of academic sessions
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
 *                     $ref: '#/components/schemas/AcademicSession'
 *       401:
 *         description: Not authenticated
 */
academicSessionRoutes.get("/", requireAuth, getAcademicSessions);

export default academicSessionRoutes;
