/**
 * @file Read-only course endpoints open to every logged-in user.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import express from "express";
import { getcourses, getCourseById } from "./courseController.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Course:
 *       type: object
 *       required:
 *         - course_code
 *         - course_name
 *         - level
 *         - department_id
 *         - credit_unit
 *         - lecturer_id
 *         - semester
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the course (UUID)
 *           example: "d290f1ee-6c54-4b01-90e6-d701748f0851"
 *         course_code:
 *           type: string
 *           description: The course code
 *           example: "CSC101"
 *         course_name:
 *           type: string
 *           description: The full name of the course
 *           example: "Introduction to Computer Science"
 *         level:
 *           type: integer
 *           description: The academic level of the course
 *           example: 100
 *         department_id:
 *           type: string
 *           description: The ID of the department
 *           example: "dept-456"
 *         credit_unit:
 *           type: integer
 *           description: The credit unit/load for the course
 *           example: 3
 *         lecturer_id:
 *           type: string
 *           description: The ID of the lecturer assigned
 *           example: "lect-789"
 *         semester:
 *           type: integer
 *           enum: [1, 2]
 *           description: Which semester the course runs in — 1 = first semester, 2 = second semester
 *           example: 1
 *
 *     CourseInput:
 *       type: object
 *       required:
 *         - course_code
 *         - course_name
 *         - level
 *         - department_id
 *         - credit_unit
 *         - lecturer_id
 *         - semester
 *       properties:
 *         course_code:
 *           type: string
 *           example: "CSC101"
 *         course_name:
 *           type: string
 *           example: "Introduction to Computer Science"
 *         level:
 *           type: integer
 *           example: 100
 *         department_id:
 *           type: string
 *           example: "dept-456"
 *         credit_unit:
 *           type: integer
 *           example: 3
 *         lecturer_id:
 *           type: string
 *           example: "lect-789"
 *         semester:
 *           type: integer
 *           enum: [1, 2]
 *           description: 1 = first semester, 2 = second semester
 *           example: 1
 *
 *     CourseUpdateInput:
 *       type: object
 *       properties:
 *         course_code:
 *           type: string
 *           example: "CSC102"
 *         course_name:
 *           type: string
 *           example: "Advanced Computer Science"
 *         level:
 *           type: integer
 *           example: 200
 *         department_id:
 *           type: string
 *           example: "dept-456"
 *         credit_unit:
 *           type: integer
 *           example: 4
 *         lecturer_id:
 *           type: string
 *           example: "lect-789"
 *         semester:
 *           type: integer
 *           enum: [1, 2]
 *           description: 1 = first semester, 2 = second semester
 *           example: 2
 */

/**
 * @swagger
 * /courses/courses:
 *   get:
 *     summary: Get all courses
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: List of all courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Course'
 *       400:
 *         description: Failed to fetch courses from Supabase
 */
router.get("/courses", getcourses);

/**
 * @swagger
 * /courses/courses/{id}:
 *   get:
 *     summary: Get a course by ID
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
 *         description: Course details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: Course ID is missing
 *       404:
 *         description: Course not found
 */
router.get("/courses/:id", getCourseById);

export default router;
