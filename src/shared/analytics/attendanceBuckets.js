/**
 * @file The rules that turn a student's `session_attendance` row (plus that
 * row's `attendance_checks`) into one of four display buckets — Present,
 * Incomplete, Absent, Flagged — and into the list of verification problems
 * behind it, so every screen that shows "what happened to this student in this
 * class" agrees.
 *
 * @remarks
 * Shared by the Class Attendance Record ("roster",
 * `lecturer/roster/rosterCalculations.js`), the Course Details attendance
 * matrix (`lecturer/course-details/attendanceMatrixCalculations.js`) and the
 * Dashboard's review queue (`lecturer/dashboard/`): the same student in the
 * same session must read the same everywhere, so the rules live once, here.
 * No database access — callers pass the rows.
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

/**
 * The specific verification problems behind a student's row this session,
 * for display as badges (e.g. "GPS Failed"). Independent of
 * {@link classifyAttendanceBucket} — a student can be bucketed "Present"
 * and still show a past issue that later resolved itself (e.g. one failed
 * check followed by a passing one), so this is its own pass over the same
 * checks rather than a side effect of the bucket decision.
 *
 * @param {object|null} attendanceRow - Their `session_attendance` row for this session, or null.
 * @param {object[]} checksForRow - That row's `attendance_checks` rows.
 * @param {{ scheduled_start_at: string, actual_end_at: string|null }} session - The class session.
 * @param {number} lateThresholdMinutes - Minutes after `scheduled_start_at` that still counts as on time
 *   (see `LATE_THRESHOLD_MINUTES` in `sessionAttendanceService.js` — the same threshold that decides
 *   PRESENT vs LATE at join time).
 * @param {number} checkIntervalMinutes - The server-enforced spacing between checks (`CHECK_INTERVAL_MINUTES`)
 *   — a check is only "missing" if none landed within this many minutes of the session ending.
 * @returns {string[]} Zero or more of "GPS Failed", "Late Joined", "Missing Final Check", "Multiple Failed Checks".
 */
export function buildVerificationIssues(attendanceRow, checksForRow, session, lateThresholdMinutes, checkIntervalMinutes) {
  if (!attendanceRow) return [];

  const issues = [];

  if (checksForRow.some((check) => check.gps_outcome === "FAILED")) {
    issues.push("GPS Failed");
  }

  if (attendanceRow.join_time && session.scheduled_start_at) {
    const minutesLate = (new Date(attendanceRow.join_time).getTime() - new Date(session.scheduled_start_at).getTime()) / 60000;
    if (minutesLate > lateThresholdMinutes) issues.push("Late Joined");
  }

  if (session.actual_end_at) {
    const finalWindowStart = new Date(session.actual_end_at).getTime() - checkIntervalMinutes * 60000;
    const hasCheckNearTheEnd = checksForRow.some((check) => new Date(check.checked_at).getTime() >= finalWindowStart);
    if (!hasCheckNearTheEnd) issues.push("Missing Final Check");
  }

  if (checksForRow.filter((check) => check.overall_match === false).length >= 2) {
    issues.push("Multiple Failed Checks");
  }

  return issues;
}

