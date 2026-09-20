import rateLimit from "express-rate-limit";
import {
  createcourses,
  deleteCourseController,
  getcourses,
  updateCourse,
  getCourseById,
  getMyCourses,
  getMyCourseStats,
} from "../controllers/coursescontroller.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

import express from "express";

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
router.post("/createcourses", courseCreationLimiter, createcourses);

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
 * /courses/mine:
 *   get:
 *     summary: Get courses assigned to the logged-in lecturer
 *     description: >
 *       Each course carries its owning department as
 *       `departments: { name }` (null when it has none).
 *     tags: [Courses]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of courses assigned to the authenticated lecturer
 *       401:
 *         description: Not authenticated
 */
router.get("/mine", requireAuth, getMyCourses);

/**
 * @swagger
 * /courses/mine/stats:
 *   get:
 *     summary: Enrolment size, semester attendance and weekly trend for each of the logged-in lecturer's courses
 *     description: >
 *       Attendance is each ENROLLED student's present/late count divided by
 *       the admin-set expected classes per semester (capped at 100%),
 *       averaged across the course's enrolled students. Only sessions in
 *       the current academic session that ran for at least half their
 *       scheduled length count. Trend is the change against 7 days ago.
 *
 *       Also returns the exam-eligibility numbers. `min_classes_for_exam` is
 *       the fewest attended classes that reach the institution's minimum
 *       attendance percentage. `students_at_risk` counts enrolled students
 *       who can no longer reach it, even if they attend every class still to
 *       come in the semester.
 *     tags: [Courses]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: One stats row per course the lecturer teaches
 *       403:
 *         description: Not a Lecturer
 */
router.get("/mine/stats", requireAuth, requireRole("Lecturer"), getMyCourseStats);

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
router.patch("/courses/:id", updateCourse);

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
router.delete("/courses/:id", deleteCourseController);


export default router;