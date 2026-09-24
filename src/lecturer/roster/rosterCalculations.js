/**
 * @file Pure logic behind the Class Attendance Record ("roster") page for
 * one held session: classifying each enrolled student into a display
 * bucket, listing their verification issues, and rolling those buckets up
 * into the sidebar's breakdown and the flagged-review list.
 *
 * @remarks
 * No database access and no clock reads — `rosterService.js` gathers the
 * raw rows (the session, each student's `session_attendance` row if any,
 * their `attendance_checks`) and hands them here, so every rule below is
 * unit-testable on its own, the same split `shared/analytics/attendanceCalculations.js`
 * uses.
 *
 * `session_attendance.status` only has four real values (PRESENT, LATE,
 * FLAGGED, ABSENT — LEFT_EARLY is defined in the schema but never set by
 * any code path today). The roster's own vocabulary (Present, Incomplete,
 * Absent, Flagged) is a display bucket derived from that status plus the
 * session's checks, not a stored value — "Incomplete" in particular does
 * not exist in the database:
 *   - FLAGGED -> "Flagged" (already an escalated state — two failed/missed checks).
 *   - ABSENT, or no session_attendance row at all -> "Absent" (never
 *     verified as present, whether the missed-check monitor decided that
 *     or the student simply never joined).
 *   - PRESENT/LATE with an unresolved failed or unavailable check ->
 *     "Incomplete" — they made it in, but something about their
 *     verification hasn't been cleared yet.
 *   - PRESENT/LATE with nothing unresolved -> "Present".
 *   - Any other stored status (i.e. LEFT_EARLY, if it's ever set) ->
 *     "Flagged", a safe default so an unrecognised state is never
 *     silently treated as fine.
 * A lecturer's Override always writes one of the four REAL statuses (see
 * `shared/session-attendance/sessionAttendanceService.js`'s
 * `overrideAttendance`) — there is no way to override a row directly to
 * "Incomplete", because it isn't a status the row can hold.
 */

/** The roster's own display statuses — see the file header for how each is derived. */
export const ROSTER_STATUSES = ["Present", "Incomplete", "Absent", "Flagged"];

/**
 * Buckets one enrolled student into a roster display status.
 *
 * @param {object|null} attendanceRow - Their `session_attendance` row for
 *   this session, or null when they never joined it.
 * @param {object[]} checksForRow - That row's `attendance_checks` rows (empty if `attendanceRow` is null).
 * @returns {"Present"|"Incomplete"|"Absent"|"Flagged"}
 */
export function classifyAttendanceBucket(attendanceRow, checksForRow) {
  if (!attendanceRow) return "Absent";

  if (attendanceRow.status === "FLAGGED") return "Flagged";
  if (attendanceRow.status === "ABSENT") return "Absent";

  if (attendanceRow.status === "PRESENT" || attendanceRow.status === "LATE") {
    const hasUnresolvedIssue = checksForRow.some(
      (check) => !check.resolved && (check.overall_match === false || check.gps_outcome === "UNAVAILABLE" || check.ip_outcome === "UNAVAILABLE")
    );
    return hasUnresolvedIssue ? "Incomplete" : "Present";
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

/**
 * Builds one roster row per enrolled student, for a single held session.
 *
 * @param {object} args
 * @param {object[]} args.enrolledStudents - `{ id, full_name, institution_identifier }` for every ENROLLED student.
 * @param {Map<string, object>} args.attendanceByStudent - That session's `session_attendance` rows, keyed by student id.
 * @param {Map<string, object[]>} args.checksByAttendanceId - That session's `attendance_checks` rows, keyed by `session_attendance.id`.
 * @param {Map<string, number>} args.termPercentByStudent - Each student's term-to-date attendance percent
 *   (see `computeStudentPresentCounts` + `studentAttendancePercent` in `shared/analytics/attendanceCalculations.js`).
 * @param {object} args.session - The held session (`scheduled_start_at`, `actual_end_at`).
 * @param {number} args.lateThresholdMinutes
 * @param {number} args.checkIntervalMinutes
 * @returns {Array<{studentId: string, fullName: string, institutionIdentifier: string, attendancePercent: number,
 *   status: string, verificationIssues: string[], sessionAttendanceId: string|null}>}
 *   Sorted the same way the mock table was: students with issues first (Flagged, then Incomplete), then Absent, then Present.
 */
export function buildFullRoster({
  enrolledStudents,
  attendanceByStudent,
  checksByAttendanceId,
  termPercentByStudent,
  session,
  lateThresholdMinutes,
  checkIntervalMinutes,
}) {
  const rows = enrolledStudents.map((student) => {
    const attendanceRow = attendanceByStudent.get(student.id) ?? null;
    const checksForRow = attendanceRow ? checksByAttendanceId.get(attendanceRow.id) ?? [] : [];

    return {
      studentId: student.id,
      fullName: student.full_name,
      institutionIdentifier: student.institution_identifier,
      attendancePercent: termPercentByStudent.get(student.id) ?? 0,
      status: classifyAttendanceBucket(attendanceRow, checksForRow),
      verificationIssues: buildVerificationIssues(attendanceRow, checksForRow, session, lateThresholdMinutes, checkIntervalMinutes),
      sessionAttendanceId: attendanceRow?.id ?? null,
    };
  });

  const priority = { Flagged: 0, Incomplete: 1, Absent: 2, Present: 3 };
  return rows.sort((a, b) => priority[a.status] - priority[b.status]);
}

/**
 * The students who need manual review this session — anyone bucketed
 * Flagged or Incomplete. Absent students are left out: there is nothing to
 * verify for someone who simply wasn't there, only something to override.
 *
 * @param {ReturnType<typeof buildFullRoster>} fullRoster
 */
export function buildFlaggedList(fullRoster) {
  return fullRoster.filter((row) => row.status === "Flagged" || row.status === "Incomplete");
}

/**
 * What fraction of enrolled students landed in each bucket this session, as
 * whole-number percentages (each rounded independently, so the four values
 * are not guaranteed to sum to exactly 100).
 *
 * @param {ReturnType<typeof buildFullRoster>} fullRoster
 * @returns {{ presentPercent: number, incompletePercent: number, absentPercent: number, flaggedPercent: number }}
 *   All zero when `fullRoster` is empty (nobody enrolled).
 */
export function buildStatusBreakdown(fullRoster) {
  const total = fullRoster.length;
  const percentOf = (status) => {
    if (total === 0) return 0;
    const count = fullRoster.filter((row) => row.status === status).length;
    return Math.round((count / total) * 100);
  };

  return {
    presentPercent: percentOf("Present"),
    incompletePercent: percentOf("Incomplete"),
    absentPercent: percentOf("Absent"),
    flaggedPercent: percentOf("Flagged"),
  };
}
