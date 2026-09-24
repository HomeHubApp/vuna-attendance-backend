/**
 * @file Admin-only department management: create, update, delete.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import express from "express";
import { requireRole } from "../../auth/authMiddleware.js";
import { createDepartmentController, updateDepartmentController, deleteDepartmentController } from "./departmentController.js";

const router = express.Router();

/**
 * @swagger
 * /department/createdepartment:
 *   post:
 *     summary: Create a new department
 *     tags: [Departments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DepartmentInput'
 *     responses:
 *       201:
 *         description: Department successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Department'
 *       400:
 *         description: Missing required fields or insertion error
 */
router.post("/createdepartment", requireRole("Admin"), createDepartmentController);

/**
 * @swagger
 * /department/departments/{id}:
 *   patch:
 *     summary: Update an existing department
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique department ID (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DepartmentUpdateInput'
 *     responses:
 *       200:
 *         description: Department successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Department'
 *       400:
 *         description: Department ID missing or update failed
 *       404:
 *         description: Department not found
 */
router.patch("/departments/:id", requireRole("Admin"), updateDepartmentController);

/**
 * @swagger
 * /department/departments/{id}:
 *   delete:
 *     summary: Delete a department by ID
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique department ID (UUID)
 *     responses:
 *       200:
 *         description: Department successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Department successfully deleted"
 *                 deletedDepartment:
 *                   $ref: '#/components/schemas/Department'
 *       400:
 *         description: Department ID missing or deletion failed
 *       404:
 *         description: Department not found
 */
router.delete("/departments/:id", requireRole("Admin"), deleteDepartmentController);

export default router;
