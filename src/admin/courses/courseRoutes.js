/**
 * @file Admin-only course management: create, update, delete.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import express from "express";
import { requireRole } from "../../auth/authMiddleware.js";
import { createcourses, updateCourse, deleteCourseController } from "./courseController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();
const courseCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many courses created from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /courses/createcourses:
 *   post:
 *     summary: Create a new course
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseInput'
 *     responses:
 *       201:
 *         description: Course successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: Missing required fields or Supabase insertion error
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/createcourses", requireRole("Admin"), courseCreationLimiter, createcourses);

/**
 * @swagger
 * /courses/courses/{id}:
 *   patch:
 *     summary: Update an existing course
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseUpdateInput'
 *     responses:
 *       200:
 *         description: Course successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: Course ID missing or update failed
 *       404:
 *         description: Course not found
 */
router.patch("/courses/:id", requireRole("Admin"), updateCourse);

/**
 * @swagger
 * /courses/courses/{id}:
 *   delete:
 *     summary: Delete a course by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique course ID
 *     responses:
 *       200:
 *         description: Course successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course successfully deleted"
 *                 deletedCourse:
 *                   $ref: '#/components/schemas/Course'
 *       400:
 *         description: Course ID missing or deletion failed
 *       404:
 *         description: Course not found
 */
router.delete("/courses/:id", requireRole("Admin"), deleteCourseController);

export default router;
