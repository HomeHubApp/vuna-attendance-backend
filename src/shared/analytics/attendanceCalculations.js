/**
 * @file Pure attendance maths: percentages, week-on-week trend, and the
 * exam-eligibility rule, given a course's `class_sessions` and
 * `session_attendance` rows. No database access and no clock reads — the
 * caller passes rows and `asOf`/`now`, so every rule here is unit-testable
 * on its own.
 *
 * @remarks
 * Lives in `shared/` because it is used by both the lecturer's course-stats
 * endpoint (`lecturer/courses/courseStatsService.js`) and, eventually, a
 * student-facing attendance view — the maths itself has no owning role.
 *
 * It also owns the exam-eligibility rule (`minClassesForExam`,
 * `canStillQualify`): a student is "at risk" when they can NO LONGER
 * qualify — their attended classes plus every class still to come (expected
 * − held) can't reach the minimum. Being behind early in the semester is
 * not "at risk"; being unable to catch up is.
 *
 * `computeStudentPresentCounts` is the shared building block behind every
 * per-student percentage in the app — `computeCourseAttendance` averages it
 * for a course, and the lecturer's roster (`lecturer/roster/rosterService.js`)
 * reads it directly for each student's own term-to-date figure.
 */

export const DEFAULT_EXPECTED_CLASSES = 12;
export const MIN_HELD_RATIO = 0.5;
export const TREND_WINDOW_DAYS = 7;

// Only these statuses mean the student was actually there.
const PRESENT_STATUSES = new Set(["PRESENT", "LATE"]);

const toMs = (value) => (value ? new Date(value).getTime() : NaN);

/**
 * How much of a session's scheduled window it really covered: the overlap
 * of [actual_start_at, actual_end_at] with [scheduled_start_at,
 * scheduled_end_at], as a fraction of the scheduled length. Using the
 * overlap (not raw actual length) means a session that a late auto-end job
 * stretched past its scheduled end can't score above 1, and one that never
 * ended has no ratio at all.
 *
 * @returns {number} 0..1, or 0 when the session hasn't ended / dates are unusable.
 */
export function heldRatio(session) {
  const scheduledStart = toMs(session.scheduled_start_at);
  const scheduledEnd = toMs(session.scheduled_end_at);
  const actualStart = toMs(session.actual_start_at);
  const actualEnd = toMs(session.actual_end_at);

  if ([scheduledStart, scheduledEnd, actualStart, actualEnd].some(Number.isNaN)) return 0;

  const scheduledLength = scheduledEnd - scheduledStart;
  if (scheduledLength <= 0) return 0;

  const overlap = Math.min(actualEnd, scheduledEnd) - Math.max(actualStart, scheduledStart);
  return Math.max(0, Math.min(1, overlap / scheduledLength));
}

/** True when the session ended and ran for at least `minRatio` of its scheduled length. */
export function isSessionHeld(session, minRatio = MIN_HELD_RATIO) {
  return session.status === "ENDED" && heldRatio(session) >= minRatio;
}

/** Whether an attendance row's status counts as the student being there. */
export function countsAsPresent(status) {
  return PRESENT_STATUSES.has(status);
}

/**
 * One student's semester attendance: presentCount / expectedClasses, capped
 * at 100 and rounded to a whole percent.
 */
export function studentAttendancePercent(presentCount, expectedClasses = DEFAULT_EXPECTED_CLASSES) {
  const expected = Number(expectedClasses) > 0 ? Number(expectedClasses) : DEFAULT_EXPECTED_CLASSES;
  return Math.round(Math.min(presentCount / expected, 1) * 100);
}

/**
 * The fewest attended classes that earn exam eligibility: the smallest
 * count whose attendance percentage (studentAttendancePercent — the same
 * rounding a student's own figure uses) reaches `minPercent`. Built on that
 * function so the "Min. N classes (X%)" a lecturer reads can never disagree
 * with a student's displayed percentage.
 *
 * @param {number} expectedClasses - classes expected per semester.
 * @param {number} minPercent - the institution's minimum attendance, 0-100.
 * @returns {number} 0..expectedClasses (0 when the minimum is 0).
 */
export function minClassesForExam(expectedClasses = DEFAULT_EXPECTED_CLASSES, minPercent) {
  const expected = Number(expectedClasses) > 0 ? Number(expectedClasses) : DEFAULT_EXPECTED_CLASSES;
  for (let classes = 0; classes <= expected; classes += 1) {
    if (studentAttendancePercent(classes, expected) >= minPercent) return classes;
  }
  // minPercent above 100 can't be met — report the whole semester.
  return expected;
}

/**
 * Whether a student can still reach exam eligibility. Every class still to
 * come (expected − held, never below 0 — a course can hold more than the
 * expected number) is assumed attended.
 *
 * @param {object} args
 * @param {number} args.presentCount - PRESENT/LATE attendances in held sessions.
 * @param {number} args.heldSessions - sessions held so far.
 * @param {number} args.expectedClasses - classes expected per semester.
 * @param {number} args.minPercent - the institution's minimum attendance, 0-100.
 * @returns {boolean}
 */
export function canStillQualify({
  presentCount,
  heldSessions,
  expectedClasses = DEFAULT_EXPECTED_CLASSES,
  minPercent,
}) {
  const expected = Number(expectedClasses) > 0 ? Number(expectedClasses) : DEFAULT_EXPECTED_CLASSES;
  const remaining = Math.max(0, expected - heldSessions);
  return presentCount + remaining >= minClassesForExam(expected, minPercent);
}

/**
 * Which sessions count as "held" as of a moment in time — held (see
 * `isSessionHeld`) AND already ended at or before `asOf`. Shared by
 * `computeStudentPresentCounts` and anything else that needs the same
 * held-as-of-when cutoff `computeCourseAttendance`'s trend uses.
 *
 * @param {object[]} sessions - `class_sessions` rows (any status).
 * @param {Date} [asOf] - only sessions that ended at or before this moment count.
 * @returns {Set<string>} ids of the sessions that count as held.
 */
function heldSessionIdsAsOf(sessions, asOf) {
  const cutoff = asOf ? asOf.getTime() : Infinity;
  return new Set(
    sessions
      .filter((session) => isSessionHeld(session) && toMs(session.actual_end_at) <= cutoff)
      .map((session) => session.id)
  );
}

/**
 * Each enrolled student's PRESENT/LATE count across the held sessions, as of
 * a moment in time. The building block every per-student or course-average
 * percentage is built on.
 *
 * @param {object} args
 * @param {object[]} args.sessions - the course's class_sessions rows (any status).
 * @param {object[]} args.attendanceRows - session_attendance rows for those sessions.
 * @param {string[]} args.enrolledStudentIds - students enrolled in the course; nobody else is counted.
 * @param {Date} [args.asOf] - only sessions that ended at or before this moment count.
 * @returns {{ presentByStudent: Map<string, number>, heldSessionIds: Set<string> }}
 *   `presentByStudent` has one entry per `enrolledStudentIds`, defaulting to 0.
 */
export function computeStudentPresentCounts({ sessions, attendanceRows, enrolledStudentIds, asOf }) {
  const heldSessionIds = heldSessionIdsAsOf(sessions, asOf);
  const presentByStudent = new Map(enrolledStudentIds.map((id) => [id, 0]));

  for (const row of attendanceRows) {
    if (!heldSessionIds.has(row.class_session_id)) continue;
    if (!presentByStudent.has(row.student_id)) continue; // not enrolled — ignored
    if (!countsAsPresent(row.status)) continue;
    presentByStudent.set(row.student_id, presentByStudent.get(row.student_id) + 1);
  }

  return { presentByStudent, heldSessionIds };
}

/**
 * A course's attendance at a moment in time.
 *
 * @param {object} args
 * @param {object[]} args.sessions - the course's class_sessions rows (any status).
 * @param {object[]} args.attendanceRows - session_attendance rows for those sessions.
 * @param {string[]} args.enrolledStudentIds - students enrolled in the course; nobody else is counted.
 * @param {number} args.expectedClasses - classes expected per semester.
 * @param {Date} [args.asOf] - only sessions that ended at or before this moment count (used for the trend).
 * @param {number} [args.minPercent] - the institution's minimum attendance. When given, `studentsAtRisk`
 *   is computed; the trend's week-ago call leaves it out.
 * @returns {{ percent: number|null, heldSessions: number, studentCount: number, studentsAtRisk: number|null }}
 *   percent is null when there is nothing to average (no enrolled students, or no held session yet).
 *   studentsAtRisk is how many enrolled students can no longer qualify (see canStillQualify) — null when
 *   `minPercent` wasn't given.
 */
export function computeCourseAttendance({
  sessions,
  attendanceRows,
  enrolledStudentIds,
  expectedClasses = DEFAULT_EXPECTED_CLASSES,
  asOf,
  minPercent,
}) {
  const wantsAtRisk = minPercent !== undefined && Number.isFinite(minPercent);
  const studentCount = enrolledStudentIds.length;
  const { presentByStudent, heldSessionIds } = computeStudentPresentCounts({
    sessions,
    attendanceRows,
    enrolledStudentIds,
    asOf,
  });

  if (studentCount === 0 || heldSessionIds.size === 0) {
    // Nobody enrolled, or nothing held yet: with every class still to come,
    // no one has lost the chance to qualify.
    return {
      percent: null,
      heldSessions: heldSessionIds.size,
      studentCount,
      studentsAtRisk: wantsAtRisk ? 0 : null,
    };
  }

  let total = 0;
  let studentsAtRisk = 0;
  for (const presentCount of presentByStudent.values()) {
    total += studentAttendancePercent(presentCount, expectedClasses);
    if (
      wantsAtRisk &&
      !canStillQualify({ presentCount, heldSessions: heldSessionIds.size, expectedClasses, minPercent })
    ) {
      studentsAtRisk += 1;
    }
  }

  return {
    percent: Math.round(total / studentCount),
    heldSessions: heldSessionIds.size,
    studentCount,
    studentsAtRisk: wantsAtRisk ? studentsAtRisk : null,
  };
}

/**
 * The course's trend: its attendance now versus TREND_WINDOW_DAYS ago.
 * `delta` is null (shown as "—") when either side has nothing to compare.
 *
 * @returns {{ current: number|null, previous: number|null, delta: number|null }}
 */
export function computeAttendanceTrend(args, now = new Date()) {
  const weekAgo = new Date(now.getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const current = computeCourseAttendance({ ...args, asOf: now }).percent;
  const previous = computeCourseAttendance({ ...args, asOf: weekAgo }).percent;
  return {
    current,
    previous,
    delta: current === null || previous === null ? null : current - previous,
  };
}
