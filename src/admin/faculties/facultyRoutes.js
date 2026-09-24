/**
 * @file Admin-only faculty management: create, update, delete.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import express from "express";
import { requireRole } from "../../auth/authMiddleware.js";
import { createFacultyController, updateFacultyController, deleteFacultyController } from "./facultyController.js";

const router = express.Router();

/**
 * @swagger
 * /faculty/createfaculty:
 *   post:
 *     summary: Create a new faculty
 *     tags: [Faculties]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FacultyInput'
 *     responses:
 *       201:
 *         description: Faculty successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Faculty name is required or insertion failed
 */
router.post("/createfaculty", requireRole("Admin"), createFacultyController);

/**
 * @swagger
 * /faculty/faculties/{id}:
 *   patch:
 *     summary: Update an existing faculty
 *     tags: [Faculties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique faculty ID (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FacultyUpdateInput'
 *     responses:
 *       200:
 *         description: Faculty successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Faculty ID missing or update failed
 *       404:
 *         description: Faculty not found
 */
router.patch("/faculties/:id", requireRole("Admin"), updateFacultyController);

/**
 * @swagger
 * /faculty/faculties/{id}:
 *   delete:
 *     summary: Delete a faculty by ID
 *     tags: [Faculties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique faculty ID (UUID)
 *     responses:
 *       200:
 *         description: Faculty successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Faculty successfully deleted"
 *                 deletedFaculty:
 *                   $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Faculty ID missing or deletion failed
 *       404:
 *         description: Faculty not found
 */
router.delete("/faculties/:id", requireRole("Admin"), deleteFacultyController);

export default router;
