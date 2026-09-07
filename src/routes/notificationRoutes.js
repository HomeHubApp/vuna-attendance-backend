import { requireAuth } from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";
import { Router } from "express";

const notificationRoutes = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         recipient_row_id:
 *           type: string
 *           format: uuid
 *           description: id of the delivery row — pass this to PATCH /notifications/{id}/read, not the notification's own id
 *         type:
 *           type: string
 *           example: class_schedule.rescheduled
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         related_entity_type:
 *           type: string
 *           nullable: true
 *           example: class_schedule
 *         related_entity_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         payload:
 *           type: object
 *           nullable: true
 *         is_read:
 *           type: boolean
 *         read_at:
 *           type: string
 *           nullable: true
 *         delivered_at:
 *           type: string
 *         created_at:
 *           type: string
 */

// This is for the GET /notifications route — fetches the logged-in user's own notifications
/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get the logged-in user's notifications, newest first
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Set to true to only return unread notifications
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max number of notifications to return (default 50)
 *     responses:
 *       200:
 *         description: Notifications fetched
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
 *                     $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Not authenticated
 */
notificationRoutes.get("/", requireAuth, getMyNotifications);

// This is for the GET /notifications/unread-count route — powers a badge/counter in the UI
/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get how many unread notifications the logged-in user has
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unread count fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */
notificationRoutes.get("/unread-count", requireAuth, getUnreadCount);

// This is for the PATCH /notifications/:id/read route — marks one notification as read
/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read (id is the delivery row's recipient_row_id)
 *     tags: [Notifications]
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
 *         description: Notification marked as read
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Notification not found
 */
notificationRoutes.patch("/:id/read", requireAuth, markNotificationAsRead);

// This is for the PATCH /notifications/read-all route — marks every notification the user has as read
/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark every notification the logged-in user has as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Not authenticated
 */
notificationRoutes.patch("/read-all", requireAuth, markAllNotificationsAsRead);

export default notificationRoutes;
