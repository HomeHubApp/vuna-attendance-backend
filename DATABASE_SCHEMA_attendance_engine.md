# Live Class & Attendance Verification System — Database Schema

Extracted from `LIVE_CLASS_ATTENDANCE_SYSTEM.md`. This covers just the schema itself — see the full doc for build phases, tooling, and open policy decisions.

---

## The mental model

- `class_schedule` = the **recurring template** ("CSC301, Mon/Wed, 10:00-12:00, Software Lab") — already built.
- `class_sessions` = one **live instance** of that template actually happening on a specific date. Created when a lecturer starts a particular day's class.
- `session_attendance` = one row per student, per session — their record of being in that specific class.
- `attendance_checks` = the periodic verification log — every 10-15 min, one row per student per check, recording where they were and whether it matched.

A student's attendance % for a course is just an aggregate query over `session_attendance` rows filtered by course. No separate "course attendance" table needed — it's a view on the same data.

---

## Venue location: the lecturer's start-GPS is the reference (no pre-seeded venue table)

Rather than maintaining a separate table of official venue coordinates, the venue's "true" location for a given session is simply **wherever the lecturer is standing when they start the session**. `class_schedule.location` stays as free text (label only) — it's descriptive, not used for geofencing. The actual comparison point lives per-session on `class_sessions.lecturer_start_lat/lng`.

**Accuracy safeguard:** the browser's Geolocation API returns an `accuracy` value (meters of possible error) alongside lat/lng. Since this single reading becomes the reference for every student's check that session, a bad fix here degrades verification for the whole class. Capture `lecturer_start_accuracy_meters` at start, and reject/retry session-start if it's above a threshold (e.g. >100m) rather than silently accepting a noisy reference point.

---

## Core schema — class sessions

```sql
CREATE TABLE class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_schedule_id UUID NOT NULL REFERENCES class_schedule(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),        -- denormalized for fast course-level queries
    lecturer_id UUID NOT NULL REFERENCES staff(user_id),

    session_date DATE NOT NULL,                             -- calendar date of this occurrence
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    scheduled_end_at TIMESTAMPTZ NOT NULL,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,

    status TEXT NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'ACTIVE', 'ENDED', 'MISSED')),

    lecturer_start_lat NUMERIC(9,6),
    lecturer_start_lng NUMERIC(9,6),
    lecturer_start_accuracy_meters NUMERIC,                 -- Geolocation API accuracy at start; reject/retry if too high
    radius_meters NUMERIC DEFAULT 50,                       -- acceptable student distance from lecturer_start_lat/lng
    venue_verified BOOLEAN DEFAULT false,                   -- did lecturer's start-check pass?

    live_headcount INTEGER DEFAULT 0,                       -- updated as students join/leave/get flagged out

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (class_schedule_id, session_date)                -- one session per schedule per day
);

CREATE INDEX idx_class_sessions_course ON class_sessions(course_id);
CREATE INDEX idx_class_sessions_status ON class_sessions(status);
```

## Student attendance per session

```sql
CREATE TABLE session_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(user_id),

    join_time TIMESTAMPTZ DEFAULT now(),
    leave_time TIMESTAMPTZ,

    status TEXT NOT NULL DEFAULT 'PRESENT'
        CHECK (status IN ('PRESENT', 'LATE', 'FLAGGED', 'LEFT_EARLY', 'ABSENT')),

    device_id TEXT,                          -- fingerprint/persistent token captured at join, for spoofing/account-sharing detection
    consecutive_failed_checks INTEGER DEFAULT 0,   -- increments on each failed check, resets on pass; drives auto-transition to FLAGGED/ABSENT

    initial_lat NUMERIC(9,6),
    initial_lng NUMERIC(9,6),
    initial_ip_address TEXT,

    final_check_pass_rate NUMERIC,          -- % of periodic checks that passed, computed at session end

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (class_session_id, student_id)   -- a student can only have one attendance row per session
);

CREATE INDEX idx_session_attendance_session ON session_attendance(class_session_id);
CREATE INDEX idx_session_attendance_student ON session_attendance(student_id);
```

## Periodic verification log — the actual "checking every 10-15 min" table

```sql
CREATE TABLE attendance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_attendance_id UUID NOT NULL REFERENCES session_attendance(id) ON DELETE CASCADE,

    checked_at TIMESTAMPTZ DEFAULT now(),

    gps_lat NUMERIC(9,6),
    gps_lng NUMERIC(9,6),
    distance_from_venue_meters NUMERIC,
    gps_outcome TEXT CHECK (gps_outcome IN ('PASSED', 'FAILED', 'UNAVAILABLE')),  -- UNAVAILABLE = no reading obtained, distinct from a failed comparison

    ip_address TEXT,
    ip_outcome TEXT CHECK (ip_outcome IN ('PASSED', 'FAILED', 'UNAVAILABLE')),

    overall_match BOOLEAN,                   -- policy-derived from gps_outcome + ip_outcome
    device_id TEXT,                          -- device fingerprint this check came from; compared against session_attendance.device_id to flag mismatches

    resolved BOOLEAN DEFAULT false,          -- has a lecturer/admin reviewed a failed check?
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_checks_session_attendance ON attendance_checks(session_attendance_id);
CREATE INDEX idx_attendance_checks_overall_match ON attendance_checks(overall_match);
```

This table is what "Flagged Records" and "Audit Log" screens read from — a flagged record is just a row here with `overall_match = false`.

## University network ranges (for the IP-based Wi-Fi substitute)

```sql
CREATE TABLE university_network_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,               -- e.g. "Main Campus Network"
    cidr_range TEXT NOT NULL,          -- e.g. "105.112.24.0/22"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Decision needed:** get the actual public IP range(s) Veritas' network egresses through, from IT/networking. Without this, `ip_outcome` can't be computed.
