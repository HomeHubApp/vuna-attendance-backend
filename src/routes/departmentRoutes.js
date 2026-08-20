import express from "express";
import {
  createDepartmentController,
  getAllDepartmentsController,
  getDepartmentByIdController,
  updateDepartmentController,
  deleteDepartmentController,
} from "../controllers/departmentcontroller.js";

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
router.post("/createdepartment", createDepartmentController);

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
router.patch("/departments/:id", updateDepartmentController);

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
router.delete("/departments/:id", deleteDepartmentController);

export default router;