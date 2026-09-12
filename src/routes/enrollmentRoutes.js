import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getEligibleCourses, enroll, getMyEnrollments, getCourseRoster } from "../controllers/enrollmentController.js";

const enrollmentRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Enrollments
 *   description: Course enrollment — student registration and lecturer rosters
 */

/**
 * @swagger
 * /enrollments/eligible-courses:
 *   get:
 *     summary: Get courses the logged-in student is eligible to enroll in (matches their department + level)
 *     tags: [Enrollments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of eligible courses
 *       404:
 *         description: Student record not found
 */
enrollmentRoutes.get("/eligible-courses", requireAuth, requireRole("Student"), getEligibleCourses);

/**
 * @swagger
 * /enrollments/mine:
 *   get:
 *     summary: Get the logged-in student's own enrollments
 *     tags: [Enrollments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of the student's enrolled courses
 */
enrollmentRoutes.get("/mine", requireAuth, requireRole("Student"), getMyEnrollments);

/**
 * @swagger
 * /enrollments:
 *   post:
 *     summary: Enroll the logged-in student in a course (must match their department + level)
 *     tags: [Enrollments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties:
 *               course_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Enrolled successfully
 *       403:
 *         description: Not eligible for this course (department/level mismatch)
 *       404:
 *         description: Student or course not found
 *       409:
 *         description: Already enrolled in this course
 */
enrollmentRoutes.post("/", requireAuth, requireRole("Student"), enroll);

/**
 * @swagger
 * /enrollments/course/{course_id}/roster:
 *   get:
 *     summary: Get the enrolled-student roster for a course (Lecturer only, must teach the course)
 *     tags: [Enrollments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: course_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of enrolled students with name and institution ID
 *       403:
 *         description: You do not teach this course
 *       404:
 *         description: Course not found
 */
enrollmentRoutes.get("/course/:course_id/roster", requireAuth, requireRole("Lecturer"), getCourseRoster);

export default enrollmentRoutes;