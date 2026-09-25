/**
 * @file Pure logic behind the Class Attendance Record ("roster") page for
 * one held session: building one row per enrolled student, and rolling their
 * display buckets up into the sidebar's breakdown and the flagged-review list.
 *
 * @remarks
 * No database access and no clock reads — `rosterService.js` gathers the
 * raw rows (the session, each student's `session_attendance` row if any,
 * their `attendance_checks`) and hands them here, so every rule below is
 * unit-testable on its own, the same split `shared/analytics/attendanceCalculations.js`
 * uses.
 *
 * The bucket itself — Present, Incomplete, Absent or Flagged, and how each is
 * derived from the stored status plus the session's checks — and the list of
 * a row's verification issues are decided in
 * `shared/analytics/attendanceBuckets.js` (`classifyAttendanceBucket`,
 * `buildVerificationIssues`), because the Course Details attendance matrix and
 * the Dashboard's review queue must show the same for the same student and
 * session. "Incomplete" is not a database status, and a lecturer's Override
 * can only write the four real ones (`overrideAttendance` in
 * `shared/session-attendance/sessionAttendanceService.js`).
 */
import { buildVerificationIssues, classifyAttendanceBucket } from "../../shared/analytics/attendanceBuckets.js";

/** The roster's own display statuses — `classifyAttendanceBucket` (shared/analytics/attendanceBuckets.js) says how each is derived. */
export const ROSTER_STATUSES = ["Present", "Incomplete", "Absent", "Flagged"];

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
