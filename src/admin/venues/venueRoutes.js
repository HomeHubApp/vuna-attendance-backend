/**
 * @file Admin-only venue management: create, update, delete.
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/authMiddleware.js";
import { createVenue, updateVenue, deleteVenue } from "./venueController.js";

const venueRoutes = Router();

/**
 * @swagger
 * /venues:
 *   post:
 *     summary: Create a venue (Admin only)
 *     tags: [Venues]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, latitude, longitude]
 *             properties:
 *               name: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               radius_meters: { type: number }
 *     responses:
 *       201:
 *         description: Venue created
 *       409:
 *         description: Venue name already exists
 */
venueRoutes.post("/", requireAuth, requireRole("Admin"), createVenue);

/**
 * @swagger
 * /venues/{id}:
 *   patch:
 *     summary: Update a venue (Admin only)
 *     tags: [Venues]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               radius_meters: { type: number }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Venue updated
 *   delete:
 *     summary: Deactivate a venue (Admin only, soft delete)
 *     tags: [Venues]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Venue deactivated
 */
venueRoutes.patch("/:id", requireAuth, requireRole("Admin"), updateVenue);
venueRoutes.delete("/:id", requireAuth, requireRole("Admin"), deleteVenue);

export default venueRoutes;
