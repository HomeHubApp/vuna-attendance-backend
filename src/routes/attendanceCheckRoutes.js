import { Router } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { checkIn } from "../controllers/attendanceCheckController.js";

const attendanceCheckRoutes = Router();

// Strong protection — this endpoint is meant to be called automatically by
// the client roughly every 10 min (server-enforced independently in the
// service itself), not by a human clicking repeatedly. 
const checkInLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.authUser?.id || ipKeyGenerator(req.ip),
    message: { error: "Too many verification attempts. Please wait before trying again." },
});

/**
 * @swagger
 * tags:
 *   name: Attendance Checks
 *   description: Periodic GPS/network verification during a live session
 */

/**
 * @swagger
 * /attendance-checks/{id}/check-in:
 *   post:
 *     summary: Submit a periodic verification check-in during an active session
 *     tags: [Attendance Checks]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: class_sessions.id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               device_id: { type: string }
 *     responses:
 *       201:
 *         description: Check-in recorded
 *       400:
 *         description: Session is not currently active
 *       404:
 *         description: You have not joined this session, or session not found
 *       429:
 *         description: Rate limited, or next verification is not due yet (server-enforced interval)
 */
attendanceCheckRoutes.post("/:id/check-in", requireAuth, requireRole("Student"), checkInLimiter, checkIn);

export default attendanceCheckRoutes;