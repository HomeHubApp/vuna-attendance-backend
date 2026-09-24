/**
 * @file Gathers the rows behind the Class Attendance Record ("roster")
 * page — one course, one specific class occurrence — and hands them to the
 * pure logic in `rosterCalculations.js`.
 *
 * @remarks
 * The roster is about ONE occurrence of a scheduled class, not the course
 * as a whole: `session_attendance.status` (and everything derived from it —
 * verification issues, Override's target row) only exists per session, so
 * "the roster" has to mean a specific date, the same way the Timetable's
 * own "View Attendance" action will link here with a `class_schedule_id` +
 * date (see `ClassScheduleCore/scheduleTiming.ts`'s `occurrenceKey` on the
 * frontend — this mirrors that same (schedule, date) identity).
 *
 * Two ways to arrive at an occurrence:
 *  - Explicit (`scheduleId` + `date` both given): the lecturer picked a
 *    specific class off their Timetable. The occurrence might genuinely
 *    not have happened — the class was scheduled but never started, and
 *    nothing else was done about it (there is no "this occurrence was
 *    rescheduled" record in this schema: rescheduling edits the
 *    `class_schedule` row itself going forward — see
 *    `shared/class-schedule/classScheduleService.js` — rather than leaving
 *    a trail against the old date). That's the `state: "not_held"` result
 *    below; the frontend is expected to render its own empty state for it.
 *  - Default (neither given): the lecturer opened the roster for a course
 *    directly (its dropdown), with no specific date in mind — resolves to
 *    the most recently ENDED, properly-held session of that course, full
 *    history, regardless of the current academic session's date window
 *    (unlike `sessionsHeldCount` below, which — like the Courses and
 *    Course Details pages — IS scoped to the current term, so that number
 *    agrees with what a lecturer sees elsewhere for the same course).
 *
 * Every student percentage returned is the same term-to-date figure the
 * Courses and Course Details pages show (via
 * `shared/analytics/attendanceCalculations.js`'s `computeStudentPresentCounts`)
 * — only the session's STATUS and verification issues are specific to the
 * one occurrence being viewed.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import ClassSchedule from "../../shared/class-schedule/classScheduleService.js";
import { LATE_THRESHOLD_MINUTES } from "../../shared/session-attendance/sessionAttendanceService.js";
import { CHECK_INTERVAL_MINUTES } from "../../config/attendancePolicy.js";
import {
  DEFAULT_EXPECTED_CLASSES,
  isSessionHeld,
  computeStudentPresentCounts,
  studentAttendancePercent,
} from "../../shared/analytics/attendanceCalculations.js";
import { fetchInChunks } from "../../shared/analytics/supabasePaging.js";
import { buildFullRoster, buildFlaggedList, buildStatusBreakdown } from "./rosterCalculations.js";

const fail = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

/** A response shape with no occurrence resolved and nothing further to compute — used by both "not held" outcomes. */
function emptyResult({ state, course, enrolledCount, sessionsHeldCount, occurrence = null }) {
  return {
    state,
    course,
    occurrence,
    summary: { enrolledCount, sessionsHeldCount, needsReviewCount: null, classAveragePercent: null },
    breakdown: null,
    flagged: null,
    roster: null,
  };
}

class Roster {
  /**
   * The Class Attendance Record for one course, resolved to one occurrence.
   *
   * @param {string} courseId
   * @param {string} lecturerId - auth user id; must own `courseId`.
   * @param {{ scheduleId?: string, date?: string }} [target] - The specific
   *   occurrence to show (both required together, a `class_schedule_id` +
   *   `YYYY-MM-DD`). Omit both to default to the most recently held session.
   * @returns {Promise<{
   *   state: "held"|"not_held"|"no_sessions_yet",
   *   course: { id: string, courseCode: string, courseTitle: string, department: string|null, creditUnit: number },
   *   occurrence: object|null,
   *   summary: { enrolledCount: number, sessionsHeldCount: number, needsReviewCount: number|null, classAveragePercent: number|null },
   *   breakdown: { presentPercent, incompletePercent, absentPercent, flaggedPercent }|null,
   *   flagged: Array|null,
   *   roster: Array|null,
   * }>}
   *   `occurrence` when `state === "not_held"` is `{ classScheduleId, date, venueName, startHour, duration }`
   *   (the schedule's own facts — no session ever ran). When `state === "held"` it is
   *   `{ sessionId, classScheduleId, date, venueName, scheduledStartAt, scheduledEndAt }` (the real session's
   *   facts — `sessionId` is `class_sessions.id`, the id Override's route takes, as distinct from
   *   `classScheduleId`, the recurring schedule row's id). `null` only for `"no_sessions_yet"`, where there
   *   is no occurrence — resolved or scheduled — to describe.
   */
  static async getRoster(courseId, lecturerId, { scheduleId, date } = {}) {
    if ((scheduleId && !date) || (date && !scheduleId)) {
      fail("scheduleId and date must be given together", 400);
    }

    const { data: courseRow, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, course_code, course_name, credit_unit, lecturer_id, department_id")
      .eq("id", courseId)
      .single();
    if (courseError || !courseRow) fail("Course not found", 404);
    if (courseRow.lecturer_id !== lecturerId) fail("You do not teach this course", 403);

    let departmentName = null;
    if (courseRow.department_id) {
      const { data: department } = await supabaseAdmin
        .from("departments")
        .select("name")
        .eq("id", courseRow.department_id)
        .maybeSingle();
      departmentName = department?.name ?? null;
    }

    const course = {
      id: courseRow.id,
      courseCode: courseRow.course_code,
      courseTitle: courseRow.course_name,
      department: departmentName,
      creditUnit: courseRow.credit_unit,
    };

    // Every session this course has ever held, newest first — used to
    // resolve "the latest one" and to compute each enrolled student's
    // term-to-date percent (both need the course's full history, not just
    // the one occurrence being viewed).
    const { data: allSessions, error: sessionsError } = await supabaseAdmin
      .from("class_sessions")
      .select(
        "id, class_schedule_id, session_date, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at, status, venues(name)"
      )
      .eq("course_id", courseId)
      .order("session_date", { ascending: false });
    if (sessionsError) fail(sessionsError.message, 500);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsError) fail(settingsError.message, 500);
    const expectedClasses = settings.expected_classes_per_semester ?? DEFAULT_EXPECTED_CLASSES;

    const { data: academicSession } = await supabaseAdmin
      .from("academic_sessions")
      .select("start_date, end_date")
      .eq("name", settings.academic_year)
      .maybeSingle();
    const inCurrentTerm = (session) =>
      (!academicSession?.start_date || session.session_date >= academicSession.start_date) &&
      (!academicSession?.end_date || session.session_date <= academicSession.end_date);
    // Course-wide, term-scoped — the same number the Courses/Course Details
    // pages show for this course, so a lecturer never sees two disagreeing
    // "sessions held" figures for the same course.
    const sessionsHeldCount = allSessions.filter((session) => inCurrentTerm(session) && isSessionHeld(session)).length;

    const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
      .from("enrollments")
      .select("student_id")
      .eq("course_id", courseId)
      .eq("status", "ENROLLED");
    if (enrollmentsError) fail(enrollmentsError.message, 500);
    const enrolledIds = enrollments.map((row) => row.student_id);

    // Resolve the occurrence.
    let targetSession;
    let resolvedScheduleId = scheduleId ?? null;
    let resolvedDate = date ?? null;

    if (scheduleId) {
      const { data: scheduleRow, error: scheduleError } = await supabaseAdmin
        .from("class_schedule")
        .select("id, course_id, day_index, lecture_date, effective_start_date, effective_end_date, start_hour, duration, venues(name)")
        .eq("id", scheduleId)
        .single();
      if (scheduleError || !scheduleRow) fail("Class schedule row not found", 404);
      if (scheduleRow.course_id !== courseId) fail("This schedule entry does not belong to this course", 400);

      const isValidOccurrence = scheduleRow.lecture_date
        ? scheduleRow.lecture_date === date
        : ClassSchedule.dayIndexOfDate(date) === scheduleRow.day_index &&
          date >= scheduleRow.effective_start_date &&
          date <= scheduleRow.effective_end_date;
      if (!isValidOccurrence) fail("This date is not a scheduled occurrence of this class", 400);

      targetSession = allSessions.find(
        (session) => session.class_schedule_id === scheduleId && session.session_date === date && session.status === "ENDED"
      );

      if (!targetSession) {
        return emptyResult({
          state: "not_held",
          course,
          enrolledCount: enrolledIds.length,
          sessionsHeldCount,
          occurrence: {
            classScheduleId: scheduleId,
            date,
            venueName: scheduleRow.venues?.name ?? null,
            startHour: scheduleRow.start_hour,
            duration: scheduleRow.duration,
          },
        });
      }
    } else {
      targetSession = allSessions.find((session) => isSessionHeld(session));
      if (!targetSession) {
        return emptyResult({ state: "no_sessions_yet", course, enrolledCount: enrolledIds.length, sessionsHeldCount });
      }
      resolvedScheduleId = targetSession.class_schedule_id;
      resolvedDate = targetSession.session_date;
    }

    let enrolledStudents = [];
    if (enrolledIds.length) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, full_name, institution_identifier")
        .in("id", enrolledIds);
      if (usersError) fail(usersError.message, 500);
      enrolledStudents = users;
    }

    // Paged and chunked: a course with a few hundred students and a few dozen
    // sessions has well over PostgREST's 1000-row default cap, and a plain
    // select would silently drop the rest, understating every term percentage.
    const allAttendanceRows = await fetchInChunks(
      allSessions.map((session) => session.id),
      (idChunk) =>
        supabaseAdmin
          .from("session_attendance")
          .select("*")
          .in("class_session_id", idChunk)
          .order("class_session_id")
          .order("student_id"),
      "Failed to fetch session attendance"
    );

    const targetAttendanceRows = allAttendanceRows.filter((row) => row.class_session_id === targetSession.id);
    const enrolledIdSet = new Set(enrolledIds);
    const attendanceByStudent = new Map(
      targetAttendanceRows.filter((row) => enrolledIdSet.has(row.student_id)).map((row) => [row.student_id, row])
    );

    const targetAttendanceIds = targetAttendanceRows.map((row) => row.id);
    const checksByAttendanceId = new Map();
    if (targetAttendanceIds.length) {
      const { data: checks, error: checksError } = await supabaseAdmin
        .from("attendance_checks")
        .select("*")
        .in("session_attendance_id", targetAttendanceIds);
      if (checksError) fail(checksError.message, 500);
      for (const check of checks) {
        if (!checksByAttendanceId.has(check.session_attendance_id)) checksByAttendanceId.set(check.session_attendance_id, []);
        checksByAttendanceId.get(check.session_attendance_id).push(check);
      }
    }

    const { presentByStudent } = computeStudentPresentCounts({
      sessions: allSessions,
      attendanceRows: allAttendanceRows,
      enrolledStudentIds: enrolledIds,
      asOf: new Date(),
    });
    const termPercentByStudent = new Map(
      [...presentByStudent.entries()].map(([studentId, count]) => [studentId, studentAttendancePercent(count, expectedClasses)])
    );

    const roster = buildFullRoster({
      enrolledStudents,
      attendanceByStudent,
      checksByAttendanceId,
      termPercentByStudent,
      session: targetSession,
      lateThresholdMinutes: LATE_THRESHOLD_MINUTES,
      checkIntervalMinutes: CHECK_INTERVAL_MINUTES,
    });
    const flagged = buildFlaggedList(roster);
    const breakdown = buildStatusBreakdown(roster);

    return {
      state: "held",
      course,
      occurrence: {
        // The real class_sessions.id — needed by the frontend to call the
        // override endpoint (PATCH /session-attendance/:sessionId/override/:studentId),
        // which operates on the session, not the recurring schedule row.
        sessionId: targetSession.id,
        classScheduleId: resolvedScheduleId,
        date: resolvedDate,
        venueName: targetSession.venues?.name ?? null,
        scheduledStartAt: targetSession.scheduled_start_at,
        scheduledEndAt: targetSession.scheduled_end_at,
      },
      summary: {
        enrolledCount: enrolledIds.length,
        sessionsHeldCount,
        needsReviewCount: flagged.length,
        // "Class average" for one session = its attendance rate — the same
        // present-bucket percentage the breakdown shows, restated as the
        // headline number.
        classAveragePercent: breakdown.presentPercent,
      },
      breakdown,
      flagged,
      roster,
    };
  }
}

export default Roster;
