import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getMyCourses,
  enrollInCourse,
  unenrollFromCourse,
} from "../controllers/studentCourseController.js";

const studentCourseRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Student Courses
 *   description: A student's own course list — eligibility + enrollment status, and self-service enroll/unenroll
 */

/**
 * @swagger
 * /students/me/courses:
 *   get:
 *     summary: Get every course the logged-in student is eligible for, with their enrollment status
 *     tags: [Student Courses]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of eligible courses, each with enrollment_status ENROLLED, UNENROLLED, or NOT_ENROLLED
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       course_id: { type: string, format: uuid }
 *                       course_code: { type: string, example: "MATH101" }
 *                       course_name: { type: string, example: "Calculus I" }
 *                       enrollment_status:
 *                         type: string
 *                         enum: [ENROLLED, UNENROLLED, NOT_ENROLLED]
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Student record not found
 */
studentCourseRoutes.get("/me/courses", requireAuth, requireRole("Student"), getMyCourses);

/**
 * @swagger
 * /students/me/courses/{courseId}/enroll:
 *   post:
 *     summary: Enroll the logged-in student in a course they're eligible for
 *     tags: [Student Courses]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Enrolled (idempotent — already-ENROLLED returns success too, an existing UNENROLLED row is flipped back rather than duplicated)
 *       400:
 *         description: courseId missing
 *       403:
 *         description: Not eligible for this course (no matching course_eligibility row for the student's department + level)
 *       404:
 *         description: Student record not found
 */
studentCourseRoutes.post(
  "/me/courses/:courseId/enroll",
  requireAuth,
  requireRole("Student"),
  enrollInCourse
);

/**
 * @swagger
 * /students/me/courses/{courseId}/unenroll:
 *   post:
 *     summary: Unenroll the logged-in student from a course
 *     tags: [Student Courses]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unenrolled (flips status to UNENROLLED, never deletes the row — no-op success if no row existed)
 *       400:
 *         description: courseId missing
 */
studentCourseRoutes.post(
  "/me/courses/:courseId/unenroll",
  requireAuth,
  requireRole("Student"),
  unenrollFromCourse
);

export default studentCourseRoutes;
