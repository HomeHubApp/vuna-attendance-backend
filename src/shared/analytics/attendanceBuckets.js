/**
 * @file The rule that turns a student's `session_attendance` row (plus that
 * row's `attendance_checks`) into one of four display buckets — Present,
 * Incomplete, Absent, Flagged — so every screen that shows "what happened to
 * this student in this class" agrees.
 *
 * @remarks
 * Shared by the Class Attendance Record ("roster",
 * `lecturer/roster/rosterCalculations.js`) and the Course Details attendance
 * matrix (`lecturer/course-details/attendanceMatrixCalculations.js`): the
 * same student in the same session must read the same in both, so the rule
 * lives once, here. No database access — callers pass the rows.
 *
 * `session_attendance.status` only has four real values (PRESENT, LATE,
 * FLAGGED, ABSENT — LEFT_EARLY is defined in the schema but never set by any
 * code path today). The buckets are a display vocabulary derived from that
 * status plus the session's checks, not a stored value — "Incomplete" in
 * particular does not exist in the database:
 *   - FLAGGED -> "Flagged" (already escalated — two failed/missed checks).
 *   - ABSENT, or no session_attendance row at all -> "Absent" (never verified
 *     as present, whether the missed-check monitor decided that or the
 *     student simply never joined).
 *   - PRESENT/LATE with an unresolved failed or unavailable check ->
 *     "Incomplete" — they made it in, but something about their verification
 *     hasn't been cleared yet.
 *   - PRESENT/LATE with nothing unresolved -> "Present".
 *   - Any other stored status (i.e. LEFT_EARLY, if it's ever set) ->
 *     "Flagged", a safe default so an unrecognised state is never silently
 *     treated as fine.
 * A lecturer's Override always writes one of the four REAL statuses (see
 * `shared/session-attendance/sessionAttendanceService.js`'s
 * `overrideAttendance`) — there is no way to override a row to "Incomplete".
 */

/**
 * The same "unresolved failed or unavailable check" test as
 * {@link hasUnresolvedIssue}, written as a PostgREST `or(...)` filter, for
 * callers that want the database to do the narrowing (a course's checks run
 * to thousands of rows; only the problem ones matter). Use it together with
 * `.not("resolved", "is", true)`. Keep it in step with `hasUnresolvedIssue`,
 * which is what the buckets are actually decided by.
 */
export const UNRESOLVED_ISSUE_FILTER = "overall_match.eq.false,gps_outcome.eq.UNAVAILABLE,ip_outcome.eq.UNAVAILABLE";

/**
 * Whether one verification check is an unresolved problem: it failed to match
 * (or couldn't get a GPS/IP reading at all) and no lecturer has reviewed it.
 *
 * @param {{ resolved?: boolean|null, overall_match?: boolean|null, gps_outcome?: string|null, ip_outcome?: string|null }} check
 * @returns {boolean}
 */
export function hasUnresolvedIssue(check) {
  return !check.resolved && (check.overall_match === false || check.gps_outcome === "UNAVAILABLE" || check.ip_outcome === "UNAVAILABLE");
}

/**
 * Buckets one enrolled student's attendance in one session.
 *
 * @param {object|null} attendanceRow - Their `session_attendance` row for
 *   this session, or null when they never joined it.
 * @param {object[]} checksForRow - That row's `attendance_checks` rows (empty
 *   if `attendanceRow` is null). Only the unresolved problem checks are
 *   looked at, so callers may pass just those (see {@link UNRESOLVED_ISSUE_FILTER}).
 * @returns {"Present"|"Incomplete"|"Absent"|"Flagged"}
 */
export function classifyAttendanceBucket(attendanceRow, checksForRow) {
  if (!attendanceRow) return "Absent";

  if (attendanceRow.status === "FLAGGED") return "Flagged";
  if (attendanceRow.status === "ABSENT") return "Absent";

  if (attendanceRow.status === "PRESENT" || attendanceRow.status === "LATE") {
    return checksForRow.some(hasUnresolvedIssue) ? "Incomplete" : "Present";
  }

  return "Flagged";
}
