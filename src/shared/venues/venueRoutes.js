/**
 * @file Read-only venue endpoints open to every logged-in user (lecturers pick a venue when scheduling).
 *
 * @remarks
 * Served at the same URL as before (see `src/routes.js`); only the file's location changed. Business logic lives in the service the controller calls.
 */
import { Router } from "express";
import { requireAuth } from "../../auth/authMiddleware.js";
import { getVenues, getVenue } from "./venueController.js";

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
 */
venueRoutes.get("/", requireAuth, getVenues);

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
 */
venueRoutes.get("/:id", requireAuth, getVenue);

export default venueRoutes;
