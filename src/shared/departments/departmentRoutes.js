/**
 * @file Read-only department endpoints open to every logged-in user.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import express from "express";
import { getAllDepartmentsController, getDepartmentByIdController } from "./departmentController.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Department:
 *       type: object
 *       required:
 *         - name
 *         - abbreviation
 *         - faculty_id
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the department (UUID)
 *           example: "a1b2c3d4-e5f6-7a8b-9c0d-1234567890ab"
 *         name:
 *           type: string
 *           description: The full name of the department
 *           example: "Computer Science"
 *         abbreviation:
 *           type: string
 *           description: The unique abbreviation/code for the department
 *           example: "CSC"
 *         faculty_id:
 *           type: string
 *           description: The ID of the faculty this department belongs to (UUID)
 *           example: "f47ac10b-58cc-4372-a567-0e02b2c3d4e5"
 * 
 *     DepartmentInput:
 *       type: object
 *       required:
 *         - name
 *         - abbreviation
 *         - faculty_id
 *       properties:
 *         name:
 *           type: string
 *           example: "Computer Science"
 *         abbreviation:
 *           type: string
 *           example: "CSC"
 *         faculty_id:
 *           type: string
 *           description: The ID of the faculty this department belongs to (UUID)
 *           example: "f47ac10b-58cc-4372-a567-0e02b2c3d4e5"
 * 
 *     DepartmentUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Information Technology"
 *         abbreviation:
 *           type: string
 *           example: "IT"
 *         faculty_id:
 *           type: string
 *           description: The ID of the faculty this department belongs to (UUID)
 *           example: "f47ac10b-58cc-4372-a567-0e02b2c3d4e5"
 */

/**
 * @swagger
 * /department/departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: List of all departments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Department'
 *       400:
 *         description: Failed to fetch departments
 */
router.get("/departments", getAllDepartmentsController);

/**
 * @swagger
 * /department/departments/{id}:
 *   get:
 *     summary: Get a department by ID
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
 *         description: Department details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Department'
 *       400:
 *         description: Department ID is missing
 *       404:
 *         description: Department not found
 */
router.get("/departments/:id", getDepartmentByIdController);

export default router;
