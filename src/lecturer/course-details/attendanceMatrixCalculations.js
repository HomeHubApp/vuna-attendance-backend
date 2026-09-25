/**
 * @file Pure logic behind the Course Details attendance matrix — one row per
 * enrolled student, one column per held session: which sessions become
 * columns, what each cell says, and each row's attendance percentage and
 * eligibility.
 *
 * @remarks
 * No database access and no clock reads — `courseDetailsService.js` gathers
 * the rows and hands them here, so every rule below is unit-testable on its
 * own, the same split as `courseDetailsCalculations.js` (the header and stat
 * cards) uses.
 *
 * Nothing here is invented for this page: a cell's status is the shared
 * bucket rule (`shared/analytics/attendanceBuckets.js`, the same one the
 * Class Attendance Record uses), a percentage is `studentAttendancePercent`,
 * and eligibility is `classifyEligibility` (`shared/analytics/attendanceCalculations.js`,
 * the test behind the stat card's "students at risk"). So the matrix, the
 * roster and the stat cards agree by construction. A cell reading
 * "incomplete" still counts as attended in the percentage — the student
 * joined; only a check is unresolved — exactly as it does everywhere else.
 *
 * Like the header, this deliberately returns structured data, not display
 * text: dates are ISO strings and cell statuses are lowercase codes. Turning
 * them into "7 Jul" / "Mon" and icons is the frontend's job.
 */
import { classifyAttendanceBucket } from "../../shared/analytics/attendanceBuckets.js";
import { classifyEligibility, studentAttendancePercent } from "../../shared/analytics/attendanceCalculations.js";
import { teachingWeekNumber } from "../../shared/analytics/teachingWeeks.js";

/**
 * The matrix's columns: the held sessions, oldest first.
 *
 * @param {object} args
 * @param {object[]} args.sessions - The course's `class_sessions` rows in the current term.
 * @param {Set<string>} args.heldSessionIds - Ids that count as held (`computeStudentPresentCounts`'s `heldSessionIds`).
 * @param {string|null|undefined} args.termStartDate - "YYYY-MM-DD" start of the current academic session.
 * @returns {Array<{ id: string, date: string, weekNumber: number|null, scheduledStartAt: string, scheduledEndAt: string }>}
 *   Sorted by date, then scheduled start — so two classes on the same day keep a stable order.
 */
export function buildMatrixSessions({ sessions, heldSessionIds, termStartDate }) {
  return sessions
    .filter((session) => heldSessionIds.has(session.id))
    .sort((a, b) => a.session_date.localeCompare(b.session_date) || String(a.scheduled_start_at).localeCompare(String(b.scheduled_start_at)))
    .map((session) => ({
      id: session.id,
      date: session.session_date,
      weekNumber: teachingWeekNumber(session.session_date, termStartDate),
      scheduledStartAt: session.scheduled_start_at,
      scheduledEndAt: session.scheduled_end_at,
    }));
}

/**
 * One student's cells: their status in each column, in column order.
 *
 * @param {object} args
 * @param {Array<{ id: string }>} args.matrixSessions - The columns, from {@link buildMatrixSessions}.
 * @param {Map<string, object>} args.attendanceBySession - This student's `session_attendance` rows, keyed by `class_session_id`.
 * @param {Map<string, object[]>} args.checksByAttendanceId - Unresolved problem checks, keyed by `session_attendance.id`.
 * @returns {Array<"present"|"incomplete"|"absent"|"flagged">} Same length and order as `matrixSessions`.
 */
export function buildAttendanceCells({ matrixSessions, attendanceBySession, checksByAttendanceId }) {
  return matrixSessions.map((session) => {
    const row = attendanceBySession.get(session.id) ?? null;
    const checks = row ? checksByAttendanceId.get(row.id) ?? [] : [];
    return classifyAttendanceBucket(row, checks).toLowerCase();
  });
}

/**
 * The matrix's rows: every ENROLLED student, sorted by name.
 *
 * @param {object} args
 * @param {Array<{ id: string, full_name: string, institution_identifier: string|null }>} args.enrolledStudents
 * @param {Map<string, number|null>} args.levelByStudent - `students.current_level` by user id.
 * @param {Array<{ id: string }>} args.matrixSessions - The columns, from {@link buildMatrixSessions}.
 * @param {object[]} args.attendanceRows - `session_attendance` rows for the held sessions.
 * @param {Map<string, object[]>} args.checksByAttendanceId - Unresolved problem checks, keyed by `session_attendance.id`.
 * @param {Map<string, number>} args.presentByStudent - PRESENT/LATE count across held sessions (`computeStudentPresentCounts`).
 * @param {number} args.expectedClasses - Classes expected per semester.
 * @param {number} args.minPercent - The institution's minimum attendance, 0-100.
 * @returns {Array<{
 *   id: string, fullName: string, matricNo: string|null, level: number|null,
 *   attendance: string[], attendancePercent: number,
 *   eligibility: "ELIGIBLE"|"IN_PROGRESS"|"AT_RISK"
 * }>}
 *   `attendance` lines up with `matrixSessions`. `attendancePercent` is the
 *   term-to-date figure (present ÷ expected classes, capped at 100) — the same
 *   number the roster and the stat card's average are built from.
 */
export function buildAttendanceMatrixRows({
  enrolledStudents,
  levelByStudent,
  matrixSessions,
  attendanceRows,
  checksByAttendanceId,
  presentByStudent,
  expectedClasses,
  minPercent,
}) {
  const heldSessions = matrixSessions.length;

  const attendanceByStudent = new Map();
  for (const row of attendanceRows) {
    if (!attendanceByStudent.has(row.student_id)) attendanceByStudent.set(row.student_id, new Map());
    attendanceByStudent.get(row.student_id).set(row.class_session_id, row);
  }

  return enrolledStudents
    .map((student) => {
      const presentCount = presentByStudent.get(student.id) ?? 0;
      return {
        id: student.id,
        fullName: student.full_name,
        matricNo: student.institution_identifier ?? null,
        level: levelByStudent.get(student.id) ?? null,
        attendance: buildAttendanceCells({
          matrixSessions,
          attendanceBySession: attendanceByStudent.get(student.id) ?? new Map(),
          checksByAttendanceId,
        }),
        attendancePercent: studentAttendancePercent(presentCount, expectedClasses),
        eligibility: classifyEligibility({ presentCount, heldSessions, expectedClasses, minPercent }),
      };
    })
    .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
}
