import { Router } from "express";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import { getSettings, updateSettings } from "./systemSettingsController.js";

const systemSettingsRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: System Settings
 *   description: Institution-wide academic session and attendance policy
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemSettings:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         academic_year:
 *           type: string
 *           example: "2025/2026"
 *         semester:
 *           type: integer
 *           enum: [1, 2]
 *           description: 1 = first semester, 2 = second semester
 *           example: 1
 *         min_attendance_percentage:
 *           type: integer
 *           description: Minimum attendance percentage required for exam eligibility
 *           example: 75
 *         expected_classes_per_semester:
 *           type: integer
 *           description: How many classes a course is expected to hold in a semester — the denominator for a student's semester attendance percentage (default 12)
 *           example: 12
 *         require_location_verification:
 *           type: boolean
 *           description: Students must have location enabled to be marked present
 *           example: true
 *         require_wifi_verification:
 *           type: boolean
 *           description: Students must be connected to campus Wi-Fi to be marked present
 *           example: true
 *         updated_by:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         updated_at:
 *           type: string
 *
 *     SystemSettingsUpdateInput:
 *       type: object
 *       description: Every field is optional — only send what changed
 *       properties:
 *         academic_year:
 *           type: string
 *           example: "2025/2026"
 *         semester:
 *           type: integer
 *           enum: [1, 2]
 *           example: 2
 *         min_attendance_percentage:
 *           type: integer
 *           example: 75
 *         expected_classes_per_semester:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 12
 *         require_location_verification:
 *           type: boolean
 *           example: true
 *         require_wifi_verification:
 *           type: boolean
 *           example: true
 */

// This is for the GET /settings route — Admin only, this is an admin-only settings page
/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get the institution-wide academic session and attendance policy (Admin only)
 *     tags: [System Settings]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Settings fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SystemSettings'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an Admin
 */
systemSettingsRoutes.get("/", requireAuth, requireRole("Admin"), getSettings);

// This is for the GET /settings/current route — same data as GET /settings,
// but open to any authenticated role. Lecturers and students need to read
// require_location_verification / require_wifi_verification (and the
// current academic session) to drive their own attendance flows, but
// GET / above is intentionally Admin-only since it's the settings page's
// own data source — this is the read-only, role-agnostic equivalent.
/**
 * @swagger
 * /settings/current:
 *   get:
 *     summary: Get the institution-wide academic session and attendance policy (any authenticated role)
 *     tags: [System Settings]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Settings fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SystemSettings'
 *       401:
 *         description: Not authenticated
 */
systemSettingsRoutes.get("/current", requireAuth, getSettings);

// This is for the PATCH /settings route — only Admins can change institution-wide policy
/**
 * @swagger
 * /settings:
 *   patch:
 *     summary: Update the institution-wide academic session and attendance policy (Admin only)
 *     tags: [System Settings]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SystemSettingsUpdateInput'
 *     responses:
 *       200:
 *         description: Settings updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SystemSettings'
 *       400:
 *         description: No valid fields provided, or a field failed validation
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an Admin
 */
systemSettingsRoutes.patch("/", requireAuth, requireRole("Admin"), updateSettings);

export default systemSettingsRoutes;
