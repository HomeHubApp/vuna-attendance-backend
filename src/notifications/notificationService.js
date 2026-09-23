import { supabaseAdmin } from "../config/supabase.js";

class NotificationService {
  // This is for creating one notification event and fanning it out to every recipient in a single call
  // any other service in the codebase can import this and call NotificationService.notify(...) without
  // knowing anything about how notifications are stored.
  static async notify({
    type,
    title,
    message,
    recipientIds,
    relatedEntityType = null,
    relatedEntityId = null,
    payload = null,
    createdBy = null,
  }) {
    if (!type || !title || !message || !recipientIds?.length) {
      const err = new Error("type, title, message, and at least one recipientId are required");
      err.statusCode = 400;
      throw err;
    }

    // This is for inserting the single notification event row
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        type,
        title,
        message,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        payload,
        created_by: createdBy,
      })
      .select()
      .single();

    if (notificationError) {
      const err = new Error(notificationError.message || "Failed to create notification");
      err.statusCode = 500;
      throw err;
    }

    // This is for fanning the notification out to every recipient, deduplicated so the same
    // user id listed twice doesn't hit the notification_recipients unique constraint
    const recipientRows = [...new Set(recipientIds)].map((recipientId) => ({
      notification_id: notification.id,
      recipient_id: recipientId,
    }));

    const { error: recipientsError } = await supabaseAdmin
      .from("notification_recipients")
      .insert(recipientRows);

    if (recipientsError) {
      const err = new Error(recipientsError.message || "Failed to fan out notification to recipients");
      err.statusCode = 500;
      throw err;
    }

    return notification;
  }

  // This is for fetching all notifications delivered to a specific user, newest first
  static async getMyNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
    if (!userId) {
      const err = new Error("userId is required");
      err.statusCode = 400;
      throw err;
    }

    let query = supabaseAdmin
      .from("notification_recipients")
      .select(
        "id, is_read, read_at, created_at, notifications(id, type, title, message, related_entity_type, related_entity_id, payload, created_at)"
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // This is for restricting the results to unread notifications only, when the caller asks for it
    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data, error } = await query;

    if (error) {
      const err = new Error(error.message || "Failed to fetch notifications");
      err.statusCode = 500;
      throw err;
    }

    // This is for flattening the joined recipient+notification row shape into one flat object per notification
    return data.map((row) => ({
      recipient_row_id: row.id,
      is_read: row.is_read,
      read_at: row.read_at,
      delivered_at: row.created_at,
      ...row.notifications,
    }));
  }

  // This is for counting how many unread notifications a user has, e.g. for a badge/counter in the UI
  static async getUnreadCount(userId) {
    if (!userId) {
      const err = new Error("userId is required");
      err.statusCode = 400;
      throw err;
    }

    const { count, error } = await supabaseAdmin
      .from("notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    if (error) {
      const err = new Error(error.message || "Failed to count unread notifications");
      err.statusCode = 500;
      throw err;
    }

    return count ?? 0;
  }

  // This is for marking a single notification as read — scoped to the requesting user so
  // one user can't mark another user's notification as read by guessing its id
  static async markAsRead(recipientRowId, requestingUserId) {
    if (!recipientRowId) {
      const err = new Error("recipientRowId is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("notification_recipients")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", recipientRowId)
      .eq("recipient_id", requestingUserId)
      .select()
      .single();

    if (error || !data) {
      const err = new Error("Notification not found");
      err.statusCode = 404;
      throw err;
    }

    return data;
  }

  // This is for marking every notification a user has as read in one go, e.g. a "mark all read" button
  static async markAllAsRead(userId) {
    if (!userId) {
      const err = new Error("userId is required");
      err.statusCode = 400;
      throw err;
    }

    const { error } = await supabaseAdmin
      .from("notification_recipients")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    if (error) {
      const err = new Error(error.message || "Failed to mark notifications as read");
      err.statusCode = 500;
      throw err;
    }

    return { message: "All notifications marked as read" };
  }
}

export default NotificationService;
