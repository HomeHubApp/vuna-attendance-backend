import { Router } from "express";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import {
  createAcademicSession,
  getAcademicSessions,
  updateAcademicSession,
} from "./academicSessionController.js";

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
 *   post:
 *     summary: Create a new academic session (Admin only)
 *     tags: [Academic Sessions]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcademicSessionInput'
 *     responses:
 *       201:
 *         description: Academic session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AcademicSession'
 *       400:
 *         description: name is missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an Admin
 *       409:
 *         description: An academic session with this name already exists
 */
academicSessionRoutes.get("/", requireAuth, getAcademicSessions);
academicSessionRoutes.post("/", requireAuth, requireRole("Admin"), createAcademicSession);

/**
 * @swagger
 * /academic-sessions/{id}:
 *   patch:
 *     summary: Edit an academic session (Admin only). Sessions cannot be deleted.
 *     tags: [Academic Sessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcademicSessionUpdateInput'
 *     responses:
 *       200:
 *         description: Academic session updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AcademicSession'
 *       400:
 *         description: No valid fields provided, or a field failed validation
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an Admin
 *       404:
 *         description: Academic session not found
 *       409:
 *         description: An academic session with this name already exists
 */
academicSessionRoutes.patch("/:id", requireAuth, requireRole("Admin"), updateAcademicSession);

export default academicSessionRoutes;
