-- Notifications module schema.
-- Run this once against the Supabase project (SQL editor or CLI) before
-- the notification service/controller code goes live.

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,                    -- e.g. 'class_schedule.created', 'class_schedule.rescheduled', 'class_schedule.cancelled'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,              -- e.g. 'class_schedule' (nullable — not every notification is tied to a row)
    related_entity_id UUID,                -- e.g. the class_schedule.id this notification is about
    payload JSONB,                         -- optional extra structured data for rendering (course_code, location, etc.)
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (notification_id, recipient_id)
);

-- Fetching "my notifications" ordered newest-first is the hot path.
CREATE INDEX idx_notification_recipients_recipient
    ON notification_recipients (recipient_id, created_at DESC);

-- Unread-count badge queries filter on this specifically.
CREATE INDEX idx_notification_recipients_unread
    ON notification_recipients (recipient_id)
    WHERE is_read = false;
