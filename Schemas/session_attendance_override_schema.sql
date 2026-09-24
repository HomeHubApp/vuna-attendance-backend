-- Lets a lecturer's manual attendance override on the Class Attendance
-- Record ("roster") page survive even when:
--   1. the student never joined the session at all (no session_attendance
--      row exists yet — e.g. a physical register confirms they were
--      present), so the override has to be able to INSERT a row, not just
--      UPDATE one; and
--   2. there is no related attendance_checks row to attach a
--      resolution_note to — that column is scoped to one failed CHECK
--      (a single GPS/Wi-Fi verification attempt), not to the session's
--      overall status, so it can't carry the reason for a full override.
--
-- overridden_at is set once and never cleared — the permanent, immutable
-- record that this row's status was set by a human, not derived from
-- check-ins, matching the "every override is permanently logged" rule the
-- Override Attendance modal already promises on the frontend.

ALTER TABLE session_attendance
  ADD COLUMN override_reason TEXT,
  ADD COLUMN overridden_by UUID REFERENCES users(id),
  ADD COLUMN overridden_at TIMESTAMPTZ;
