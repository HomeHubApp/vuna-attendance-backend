-- Defines the pool of academic sessions (school years) the university has
-- had or will have, e.g. "2025/2026". Settings > Academic Session picks
-- one of these by name as the institution's current session
-- (system_settings.academic_year stores that name — see
-- system_settings_schema.sql). Admins can add and edit sessions here, but
-- never delete one — once created, a session is part of the institution's
-- permanent history.

CREATE TABLE academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,          -- e.g. "2025/2026"
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeds the session system_settings.academic_year already defaults to, so
-- the two stay consistent from the start.
INSERT INTO academic_sessions (name, start_date, end_date)
VALUES ('2025/2026', '2025-09-01', '2026-07-31')
ON CONFLICT (name) DO NOTHING;
