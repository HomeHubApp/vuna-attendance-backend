-- Institution-wide admin system settings (Academic Session + Attendance Policy).
-- Run this once against the Supabase project (SQL editor) before the
-- settings service/controller code goes live.
--
-- This is a singleton table — exactly one row, enforced by the id CHECK
-- constraint below — since these settings apply university-wide, not per
-- user/department. Reads/updates always target id = 1.

CREATE TABLE system_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    academic_year TEXT NOT NULL,                       -- free text the admin enters, e.g. "2025/2026"
    semester SMALLINT NOT NULL CHECK (semester IN (1, 2)), -- 1 = first semester, 2 = second semester
    min_attendance_percentage SMALLINT NOT NULL DEFAULT 75 CHECK (min_attendance_percentage BETWEEN 0 AND 100),
    require_location_verification BOOLEAN NOT NULL DEFAULT true,
    require_wifi_verification BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- This is for seeding the one settings row up front, so the app can always
-- assume it exists and just SELECT/UPDATE id = 1 without a "does it exist yet" check.
INSERT INTO system_settings (id, academic_year, semester)
VALUES (1, '2025/2026', 1)
ON CONFLICT (id) DO NOTHING;
