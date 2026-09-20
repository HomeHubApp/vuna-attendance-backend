-- Decouples "which department owns this course" (courses.department_id)
-- from "which students can see and enroll in it" (course_eligibility),
-- and gives enrollments a real self-service lifecycle: status can be
-- flipped between ENROLLED/UNENROLLED in place instead of deleting or
-- duplicating rows, and source records how the row was created (SELF for
-- now; ADMIN_BULK and PORTAL_SYNC are reserved for later work — no sync
-- job exists yet, this just avoids a second schema change once one does).
--
-- Status-like columns here follow this schema's existing convention
-- (users.status, class_sessions.status, session_attendance.status are all
-- plain text + CHECK, not Postgres enum types — no enum type exists
-- anywhere in this database, so this doesn't introduce the first one).

ALTER TABLE enrollments
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ENROLLED'
    CHECK (status IN ('ENROLLED', 'UNENROLLED')),
  ADD COLUMN source TEXT NOT NULL DEFAULT 'SELF'
    CHECK (source IN ('SELF', 'ADMIN_BULK', 'PORTAL_SYNC')),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- A student can have at most one row per course — (un)enrolling flips
-- status on that one row rather than inserting a new one. Safe to add:
-- no existing (student_id, course_id) duplicates as of this writing.
ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_student_course_unique UNIQUE (student_id, course_id);

-- course_eligibility is the source of truth for "which (department,
-- level) pairs can see and enroll in this course" — courses.department_id
-- stays as the OWNING department (who administers/teaches it) but no
-- longer gates visibility on its own. A cross-listed course like MATH101
-- gets one row per eligible (department, level) pair.
CREATE TABLE course_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,  -- matches courses.level's type/convention (e.g. 100, 200...)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, department_id, level)
);

-- One-off backfill: every existing course becomes eligible for its own
-- owning department at its own level, so nothing currently visible
-- becomes invisible. Cross-listed (department, level) pairs beyond a
-- course's own department are added manually afterward, per course.
INSERT INTO course_eligibility (course_id, department_id, level)
SELECT id, department_id, level
FROM courses
WHERE department_id IS NOT NULL
ON CONFLICT (course_id, department_id, level) DO NOTHING;
