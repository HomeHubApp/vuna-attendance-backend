import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { createVenue, getVenues, getVenue, updateVenue, deleteVenue } from "../controllers/venueController.js";

const venueRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Venues
 *   description: Lecture venue management
 */

/**
 * @swagger
 * /venues:
 *   get:
 *     summary: List venues (active only by default; ?all=true for admins to include inactive)
 *     tags: [Venues]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: all
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of venues
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
venueRoutes.get("/", requireAuth, getVenues);
venueRoutes.post("/", requireAuth, requireRole("Admin"), createVenue);

/**
 * @swagger
 * /venues/{id}:
 *   get:
 *     summary: Get a single venue
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
 *         description: Venue found
 *       404:
 *         description: Venue not found
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
venueRoutes.get("/:id", requireAuth, getVenue);
venueRoutes.patch("/:id", requireAuth, requireRole("Admin"), updateVenue);
venueRoutes.delete("/:id", requireAuth, requireRole("Admin"), deleteVenue);

export default venueRoutes;