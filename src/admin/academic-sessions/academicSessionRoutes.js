/**
 * @file Admin-only academic session management: create, update.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { createAcademicSession, updateAcademicSession } from "./academicSessionController.js";

const academicSessionRoutes = Router();

/**
 * @swagger
 * /academic-sessions:
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
