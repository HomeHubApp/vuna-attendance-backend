import express from "express";
import {
  createFacultyController,
  getAllFacultiesController,
  getFacultyByIdController,
  updateFacultyController,
  deleteFacultyController,
} from "../controllers/FacultyController.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Faculty:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the faculty (UUID)
 *           example: "a1b2c3d4-e5f6-7a8b-9c0d-1234567890ab"
 *         name:
 *           type: string
 *           description: The full name of the faculty
 *           example: "Faculty of Engineering"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the faculty was created
 * 
 *     FacultyInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: The full name of the faculty
 *           example: "Faculty of Science"
 * 
 *     FacultyUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The updated name of the faculty
 *           example: "Faculty of Information Technology"
 */

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
router.post("/createfaculty", createFacultyController);

/**
 * @swagger
 * /faculty/faculties:
 *   get:
 *     summary: Get all faculties
 *     tags: [Faculties]
 *     responses:
 *       200:
 *         description: List of all faculties
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Failed to fetch faculties
 */
router.get("/faculties", getAllFacultiesController);

/**
 * @swagger
 * /faculty/faculties/{id}:
 *   get:
 *     summary: Get a faculty by ID
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
 *         description: Faculty details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Faculty ID is missing
 *       404:
 *         description: Faculty not found
 */
router.get("/faculties/:id", getFacultyByIdController);

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
router.patch("/faculties/:id", updateFacultyController);

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
router.delete("/faculties/:id", deleteFacultyController);

export default router;