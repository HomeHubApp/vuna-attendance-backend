/**
 * @file Gathers the rows behind the lecturer Dashboard (`GET
 * /api/lecturer-dashboard`) and hands them to the pure logic in
 * `dashboardCalculations.js`.
 *
 * @remarks
 * The Dashboard is a summary of things other pages own — the timetable, the
 * Courses page, Course Details, the roster — so this reads the same rows they
 * do and applies the same shared rules, rather than borrowing their endpoints
 * or inventing its own. The attendance rows come from
 * `shared/analytics/termAttendanceData.js`, the same loader the Courses page's
 * stats use, so a course's numbers here match its row there.
 *
 * It is one endpoint returning every section, so the page shows one loading
 * state and one answer. That makes it the widest read in the app — every
 * course's whole term of attendance — and the page polls it. If that becomes
 * too slow or costly, the first step is splitting the live parts (today's
 * schedule, the review queue) into a light endpoint of their own so they can
 * refresh often while the heavy charts refresh rarely; the second, caching per
 * lecturer for a few seconds.
 *
 * "Today" and "now" are the institution's (Nigeria, UTC+1), taken from the
 * same helpers the session-start code uses, so a class the timetable says is
 * today is the class this says is today.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import { CHECK_INTERVAL_MINUTES } from "../../config/attendancePolicy.js";
import { isSessionHeld } from "../../shared/analytics/attendanceCalculations.js";
import { UNRESOLVED_ISSUE_FILTER } from "../../shared/analytics/attendanceBuckets.js";
import { failWith, fetchInChunks } from "../../shared/analytics/supabasePaging.js";
import { fetchTermAttendanceData } from "../../shared/analytics/termAttendanceData.js";
import ClassSchedule from "../../shared/class-schedule/classScheduleService.js";
import ClassSession from "../../shared/class-sessions/classSessionService.js";
import { LATE_THRESHOLD_MINUTES } from "../../shared/session-attendance/sessionAttendanceService.js";
import {
  buildCourseFigures,
  buildReviewQueue,
  buildTodaysSchedule,
  buildWeeklyAttendance,
  combineAttendance,
  findPendingReviews,
} from "./dashboardCalculations.js";

/** How many records the review queue lists (the stat card still counts them all). */
const REVIEW_QUEUE_LIMIT = 20;

/** How many teaching weeks the attendance chart shows, ending with the current one. */
const TREND_WEEKS = 12;

const groupBy = (rows, key) => {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return groups;
};

class LecturerDashboard {
  /**
   * Everything the lecturer Dashboard shows.
   *
   * @param {string} lecturerId - auth user id of the logged-in lecturer.
   * @returns {Promise<{
   *   lecturer: { name: string|null, department: string|null },
   *   today: string,
   *   stats: { sessionsToday: number, liveNow: number, courseCount: number, pendingReviews: number,
   *     averageAttendance: { percent: number|null, change: number|null } },
   *   schedule: ReturnType<typeof buildTodaysSchedule>,
   *   reviewQueue: ReturnType<typeof buildReviewQueue>,
   *   weeklyAttendance: ReturnType<typeof buildWeeklyAttendance>,
   *   courses: ReturnType<typeof buildCourseFigures>[]
   * }>}
   *   A lecturer with no courses gets the same shape, empty. `pendingReviews`
   *   counts every record awaiting a decision; `reviewQueue` lists only the
   *   newest {@link REVIEW_QUEUE_LIMIT}.
   */
  static async getDashboard(lecturerId) {
    const now = new Date();
    const today = ClassSchedule.getTodayInNigeria();
    const dayIndex = ClassSchedule.dayIndexOfDate(today);

    const [lecturer, courses] = await Promise.all([
      LecturerDashboard.#fetchLecturer(lecturerId),
      LecturerDashboard.#fetchCourses(lecturerId),
    ]);

    if (courses.length === 0) return LecturerDashboard.#emptyDashboard({ lecturer, today });

    const courseIds = courses.map((course) => course.id);
    const [termData, scheduleRows, todaysSessions] = await Promise.all([
      fetchTermAttendanceData(courseIds),
      LecturerDashboard.#fetchScheduleRows(courseIds),
      LecturerDashboard.#fetchTodaysSessions(courseIds, today),
    ]);
    const { expectedClasses, minPercent, term, sessions, enrollments, attendanceRows } = termData;

    const sessionsByCourse = groupBy(sessions, "course_id");
    const attendanceBySession = groupBy(attendanceRows, "class_session_id");
    const enrolledIdsByCourse = new Map(
      [...groupBy(enrollments, "course_id")].map(([courseId, rows]) => [courseId, rows.map((row) => row.student_id)])
    );

    const figures = courses.map((course) => {
      const courseSessions = sessionsByCourse.get(course.id) ?? [];
      return buildCourseFigures({
        course,
        sessions: courseSessions,
        attendanceRows: courseSessions.flatMap((session) => attendanceBySession.get(session.id) ?? []),
        enrolledStudentIds: enrolledIdsByCourse.get(course.id) ?? [],
        expectedClasses,
        minPercent,
        now,
      });
    });

    const courseById = new Map(courses.map((course) => [course.id, { code: course.course_code }]));
    const courseMeta = new Map(courses.map((course) => [course.id, course]));
    const schedule = buildTodaysSchedule({
      scheduleRows: scheduleRows.map((row) => LecturerDashboard.#withTodaysTimes(row, courseMeta.get(row.course_id), today)),
      todaysSessions,
      enrolledByCourse: new Map(figures.map((figure) => [figure.id, figure.enrolled])),
      today,
      dayIndex,
      now,
    });

    const reviewQueue = await LecturerDashboard.#buildReviewQueue({
      sessions,
      attendanceRows,
      enrolledIdsByCourse,
      courseById,
    });

    return {
      lecturer,
      today,
      stats: {
        sessionsToday: schedule.length,
        liveNow: schedule.filter((item) => item.status === "live").length,
        courseCount: courses.length,
        pendingReviews: reviewQueue.total,
        averageAttendance: combineAttendance(figures),
      },
      schedule,
      reviewQueue: reviewQueue.items,
      weeklyAttendance: buildWeeklyAttendance({
        courses,
        sessionsByCourse,
        attendanceBySession,
        enrolledIdsByCourse,
        termStartDate: term?.start_date,
        today,
        weekCount: TREND_WEEKS,
      }),
      courses: figures,
    };
  }

  /** The response for a lecturer who teaches nothing yet — same shape, all empty. */
  static #emptyDashboard({ lecturer, today }) {
    return {
      lecturer,
      today,
      stats: { sessionsToday: 0, liveNow: 0, courseCount: 0, pendingReviews: 0, averageAttendance: { percent: null, change: null } },
      schedule: [],
      reviewQueue: [],
      weeklyAttendance: { weeks: [], series: [] },
      courses: [],
    };
  }

  /** A schedule row with today's scheduled start and end timestamps and its course's code and title. */
  static #withTodaysTimes(row, course, today) {
    const scheduledStartAt = ClassSession.buildScheduledStart(today, row.start_hour);
    return {
      ...row,
      course_code: course?.course_code,
      course_name: course?.course_name,
      scheduledStartAt,
      scheduledEndAt: ClassSession.addDuration(scheduledStartAt, row.duration),
    };
  }

  /**
   * The review queue: which records still await a decision (all of them, for
   * the count) and the newest few in full (for the list).
   */
  static async #buildReviewQueue({ sessions, attendanceRows, enrolledIdsByCourse, courseById }) {
    const heldSessions = sessions.filter((session) => isSessionHeld(session));
    const problemChecksByAttendanceId = await LecturerDashboard.#fetchProblemChecks(heldSessions);

    const pending = findPendingReviews({
      heldSessions,
      attendanceRows,
      problemChecksByAttendanceId,
      enrolledSetByCourse: new Map([...enrolledIdsByCourse].map(([courseId, ids]) => [courseId, new Set(ids)])),
    });

    const listed = pending.slice(0, REVIEW_QUEUE_LIMIT);
    const [usersById, checksByAttendanceId] = await Promise.all([
      LecturerDashboard.#fetchStudents(listed.map(({ row }) => row.student_id)),
      LecturerDashboard.#fetchChecks(listed.map(({ row }) => row.id)),
    ]);

    return {
      total: pending.length,
      items: buildReviewQueue({
        pending,
        limit: REVIEW_QUEUE_LIMIT,
        courseById,
        usersById,
        checksByAttendanceId,
        lateThresholdMinutes: LATE_THRESHOLD_MINUTES,
        checkIntervalMinutes: CHECK_INTERVAL_MINUTES,
      }),
    };
  }

  /** The lecturer's name and department (either may be null). */
  static async #fetchLecturer(lecturerId) {
    const [{ data: user, error: userError }, { data: staff, error: staffError }] = await Promise.all([
      supabaseAdmin.from("users").select("full_name").eq("id", lecturerId).maybeSingle(),
      supabaseAdmin.from("staff").select("departments(name)").eq("user_id", lecturerId).maybeSingle(),
    ]);
    if (userError) failWith(userError, "Failed to fetch lecturer");
    if (staffError) failWith(staffError, "Failed to fetch lecturer's department");

    return { name: user?.full_name ?? null, department: staff?.departments?.name ?? null };
  }

  /** The lecturer's courses, sorted by code. */
  static async #fetchCourses(lecturerId) {
    const { data, error } = await supabaseAdmin
      .from("courses")
      .select("id, course_code, course_name")
      .eq("lecturer_id", lecturerId);
    if (error) failWith(error, "Failed to fetch courses");
    return [...data].sort((a, b) => a.course_code.localeCompare(b.course_code));
  }

  /** The active timetable rows of the given courses, with their venue names. */
  static async #fetchScheduleRows(courseIds) {
    const { data, error } = await supabaseAdmin
      .from("class_schedule")
      .select("id, course_id, is_active, lecture_date, day_index, start_hour, duration, effective_start_date, effective_end_date, venues(name)")
      .in("course_id", courseIds)
      .eq("is_active", true);
    if (error) failWith(error, "Failed to fetch class schedule");
    return data;
  }

  /** The courses' class sessions dated today (any status), to tell which classes have started or ended. */
  static async #fetchTodaysSessions(courseIds, today) {
    const { data, error } = await supabaseAdmin
      .from("class_sessions")
      .select("id, class_schedule_id, status")
      .in("course_id", courseIds)
      .eq("session_date", today);
    if (error) failWith(error, "Failed to fetch today's sessions");
    return data;
  }

  /**
   * The unresolved failed or unavailable checks in the given sessions, keyed
   * by their `session_attendance` row. Filtered in the database (see
   * `UNRESOLVED_ISSUE_FILTER`) and joined through the row to its session, so
   * this is a handful of requests however many attendance rows there are —
   * the full check log runs to thousands of rows nobody needs here.
   */
  static async #fetchProblemChecks(heldSessions) {
    const checks = await fetchInChunks(
      heldSessions.map((session) => session.id),
      (idChunk) =>
        supabaseAdmin
          .from("attendance_checks")
          .select("id, session_attendance_id, resolved, overall_match, gps_outcome, ip_outcome, session_attendance!inner(class_session_id)")
          .in("session_attendance.class_session_id", idChunk)
          .not("resolved", "is", true)
          .or(UNRESOLVED_ISSUE_FILTER)
          .order("id"),
      "Failed to fetch attendance checks"
    );

    return groupBy(checks, "session_attendance_id");
  }

  /** Every check of the given attendance rows, keyed by row — for judging the listed rows' issues. */
  static async #fetchChecks(attendanceIds) {
    const checks = await fetchInChunks(
      attendanceIds,
      (idChunk) =>
        supabaseAdmin
          .from("attendance_checks")
          .select("id, session_attendance_id, checked_at, resolved, overall_match, gps_outcome, ip_outcome")
          .in("session_attendance_id", idChunk)
          .order("id"),
      "Failed to fetch attendance checks"
    );

    return groupBy(checks, "session_attendance_id");
  }

  /** Name and matric number of each student, by user id. */
  static async #fetchStudents(studentIds) {
    const rows = await fetchInChunks(
      [...new Set(studentIds)],
      (idChunk) => supabaseAdmin.from("users").select("id, full_name, institution_identifier").in("id", idChunk).order("id"),
      "Failed to fetch students"
    );
    return new Map(rows.map((row) => [row.id, row]));
  }
}

export default LecturerDashboard;
