import NotificationService from "../services/notificationService.js";

// This is for fetching all notifications delivered to the logged-in user, newest first
export const getMyNotifications = async (req, res) => {
  try {
    const { unreadOnly, limit } = req.query;

    const notifications = await NotificationService.getMyNotifications(req.authUser.id, {
      unreadOnly: unreadOnly === "true",
      limit: limit ? Number(limit) : undefined,
    });

    return res.status(200).json({
      message: "Notifications fetched successfully",
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch notifications",
    });
  }
};

// This is for fetching how many unread notifications the logged-in user has, for a badge/counter
export const getUnreadCount = async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.authUser.id);

    return res.status(200).json({
      message: "Unread notification count fetched successfully",
      count,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch unread notification count",
    });
  }
};

// This is for marking a single notification as read for the logged-in user
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await NotificationService.markAsRead(id, req.authUser.id);

    return res.status(200).json({
      message: "Notification marked as read",
      data: updated,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to mark notification as read",
    });
  }
};

// This is for marking every notification the logged-in user has as read in one go
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead(req.authUser.id);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to mark notifications as read",
    });
  }
};
