import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { createSchedule, deleteSchedule, getMySchedule, updateSchedule } from "../controllers/classScheduleController.js";
import { Router } from "express";

const classScheduleRoutes = Router();


/**
 * @swagger
 * components:
 *   schemas:
 *     ClassSchedule:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         course_id:
 *           type: string
 *           format: uuid
 *         course_code:
 *           type: string
 *           example: CSC401
 *         course_name:
 *           type: string
 *           example: Software Engineering
 *         schedule_type:
 *           type: string
 *           example: Lecture
 *         location:
 *           type: string
 *           example: LT1
 *         start_hour:
 *           type: string
 *           example: "10:00:00"
 *         duration:
 *           type: string
 *           example: "02:00:00"
 *         day_index:
 *           type: integer
 *           description: 0=Sunday, 1=Monday, ... 6=Saturday
 *           example: 1
 *         lecture_date:
 *           type: string
 *           nullable: true
 *           description: Only set for one-off overrides (a single date moved/cancelled). Null for normal recurring rows.
 *         effective_start_date:
 *           type: string
 *           example: "2026-08-25"
 *         effective_end_date:
 *           type: string
 *           example: "2026-12-05"
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *
 *     CreateScheduleInput:
 *       type: object
 *       required: [course_id, days]
 *       properties:
 *         course_id:
 *           type: string
 *           format: uuid
 *           description: Must be a course the requesting lecturer is assigned to
 *         schedule_type:
 *           type: string
 *           example: Lecture
 *         location:
 *           type: string
 *           example: LT1
 *         start_hour:
 *           type: string
 *           example: "10:00"
 *         duration:
 *           type: string
 *           example: "2 hours"
 *         days:
 *           type: array
 *           items:
 *             type: string
 *             enum: [SUN, MON, TUE, WED, THU, FRI, SAT]
 *           example: [MON, WED, FRI]
 *           description: One class_schedule row is created per day listed here
 *         effective_start_date:
 *           type: string
 *           example: "2026-08-25"
 *         effective_end_date:
 *           type: string
 *           example: "2026-12-05"
 */
 
/**
 * @swagger
 * /class-schedule:
 *   post:
 *     summary: Create a recurring class schedule for one of the logged-in lecturer's courses
 *     tags: [Class Schedule]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateScheduleInput'
 *     responses:
 *       201:
 *         description: One row created per selected day
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClassSchedule'
 *       400:
 *         description: Missing fields or invalid day code
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a Lecturer, or not assigned to the specified course
 *       404:
 *         description: Course not found
 */
classScheduleRoutes.post("/", requireAuth, requireRole("Lecturer"), createSchedule);
 
/**
 * @swagger
 * /class-schedule/mine:
 *   get:
 *     summary: Get the logged-in lecturer's full recurring timetable across all their courses
 *     tags: [Class Schedule]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All active schedule rows for courses this lecturer teaches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClassSchedule'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a Lecturer
 */
classScheduleRoutes.get("/mine", requireAuth, requireRole("Lecturer"), getMySchedule);
/**
 * @swagger
 * /class-schedule/{id}:
 *   patch:
 *     summary: Edit a class schedule (applies to all future occurrences — course_id cannot be changed)
 *     tags: [Class Schedule]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schedule_type: { type: string }
 *               location: { type: string }
 *               start_hour: { type: string }
 *               duration: { type: string }
 *               day_index: { type: string, enum: [SUN, MON, TUE, WED, THU, FRI, SAT] }
 *               effective_start_date: { type: string }
 *               effective_end_date: { type: string }
 *     responses:
 *       200:
 *         description: Schedule updated
 *       400:
 *         description: No valid fields provided
 *       403:
 *         description: Not assigned to this course
 *       404:
 *         description: Schedule not found
 *   delete:
 *     summary: Delete a class schedule (soft delete — marks inactive, preserves history)
 *     tags: [Class Schedule]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Schedule deleted (marked inactive)
 *       403:
 *         description: Not assigned to this course
 *       404:
 *         description: Schedule not found
 */
classScheduleRoutes.patch("/:id", requireAuth, requireRole("Lecturer"), updateSchedule);
classScheduleRoutes.delete("/:id", requireAuth, requireRole("Lecturer"), deleteSchedule);

export default classScheduleRoutes;