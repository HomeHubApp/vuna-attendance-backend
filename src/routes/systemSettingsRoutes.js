import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getSettings, updateSettings } from "../controllers/systemSettingsController.js";

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
