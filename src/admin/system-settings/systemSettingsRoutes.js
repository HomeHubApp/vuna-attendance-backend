/**
 * @file Admin-only institution settings: read the full settings page data and change policy.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { updateSettings } from "./systemSettingsController.js";
import { getSettings } from "../../shared/system-settings/systemSettingsController.js";

const systemSettingsRoutes = Router();
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
