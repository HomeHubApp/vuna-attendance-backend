/**
 * @file Gathers the rows behind the Course Details page and hands them to the
 * pure logic in `courseDetailsCalculations.js`.
 *
 * @remarks
 * The Course Details page is built in parts, each with its own endpoint, all
 * under `/api/course-details` and all in this folder. The first part is
 * `getOverview`: the header (course dropdown, facts line, exam-rule line,
 * average-attendance badge) AND the three stat cards under it, in one call —
 * they share every input (the course, its enrolled students, its attendance
 * figures), so one round trip and one loading state serve both. The
 * attendance matrix is a separate part with its own method, endpoint and
 * loading state, added when that section is built.
 *
 * It reads everything it needs itself rather than borrowing another
 * feature's endpoint or service (the header used to be stitched together in
 * the browser from four separate calls: `/courses/mine`,
 * `/courses/mine/stats`, `/class-schedule/mine` and `/settings/current`).
 * That costs a little duplicated querying — the attendance figures use the
 * same rules as `lecturer/courses/courseStatsService.js` (ENDED sessions
 * inside the current academic session's window that ran for at least half
 * their scheduled length, ENROLLED students only) via the shared maths in
 * `shared/analytics/attendanceCalculations.js` — in exchange for one
 * request per overview and a page that can change without touching the
 * Courses page.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import { DEFAULT_EXPECTED_CLASSES, computeCourseAttendance } from "../../shared/analytics/attendanceCalculations.js";
import { failWith, fetchAllPages, fetchInChunks } from "../../shared/analytics/supabasePaging.js";
import {
  buildCourseHeader,
  buildCourseOptions,
  buildCourseStats,
  buildScheduleSlots,
  pickCourse,
} from "./courseDetailsCalculations.js";

const fail = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

class CourseDetails {
  /**
   * The overview for one of the lecturer's courses: its header block, the
   * three stat cards, and the options for the course dropdown (every course
   * they teach).
   *
   * @param {string} lecturerId - auth user id of the logged-in lecturer.
   * @param {string} [requestedCourseId] - The course to show. Omit to get the
   *   first course by code, so the page can open with no course chosen.
   * @returns {Promise<{
   *   courseOptions: Array<{ id: string, code: string, title: string }>,
   *   course: ReturnType<typeof buildCourseHeader>|null,
   *   stats: ReturnType<typeof buildCourseStats>|null
   * }>}
   *   `course` and `stats` are null (and `courseOptions` empty) only when the
   *   lecturer teaches no courses at all.
   * @throws {Error} 404 when `requestedCourseId` isn't one of the lecturer's
   *   courses — whether it doesn't exist or belongs to someone else, so a
   *   lecturer can't probe for other people's course ids.
   */
  static async getOverview(lecturerId, requestedCourseId) {
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from("courses")
      .select("id, course_code, course_name, credit_unit, department_id")
      .eq("lecturer_id", lecturerId);
    if (coursesError) failWith(coursesError, "Failed to fetch courses");

    const courseOptions = buildCourseOptions(courses);
    const course = pickCourse(courses, requestedCourseId);

    if (requestedCourseId && !course) fail("Course not found", 404);
    if (!course) return { courseOptions, course: null, stats: null };

    const [departmentName, enrolledIds, scheduleRows, settings] = await Promise.all([
      CourseDetails.#fetchDepartmentName(course.department_id),
      CourseDetails.#fetchEnrolledStudentIds(course.id),
      CourseDetails.#fetchScheduleRows(course.id),
      CourseDetails.#fetchSettings(),
    ]);

    const attendance = await CourseDetails.#computeAttendance({
      courseId: course.id,
      courseCode: course.course_code,
      enrolledIds,
      settings,
    });

    return {
      courseOptions,
      course: buildCourseHeader({
        course,
        departmentName,
        enrolledCount: enrolledIds.length,
        scheduleSlots: buildScheduleSlots(scheduleRows),
        settings,
        attendance,
      }),
      stats: buildCourseStats({ enrolledCount: enrolledIds.length, attendance }),
    };
  }

  /** The owning department's name, or null when the course has none (or it was deleted). */
  static async #fetchDepartmentName(departmentId) {
    if (!departmentId) return null;
    const { data, error } = await supabaseAdmin.from("departments").select("name").eq("id", departmentId).maybeSingle();
    if (error) failWith(error, "Failed to fetch department");
    return data?.name ?? null;
  }

  /** Ids of the students ENROLLED in the course — students who merely match its department and level don't count. */
  static async #fetchEnrolledStudentIds(courseId) {
    const rows = await fetchAllPages(
      () =>
        supabaseAdmin
          .from("enrollments")
          .select("student_id")
          .eq("course_id", courseId)
          .eq("status", "ENROLLED")
          .order("student_id"),
      "Failed to fetch enrollments"
    );
    return rows.map((row) => row.student_id);
  }

  /** The course's `class_schedule` rows, including inactive and Fixed Class rows — `buildScheduleSlots` decides which count. */
  static async #fetchScheduleRows(courseId) {
    const { data, error } = await supabaseAdmin
      .from("class_schedule")
      .select("is_active, lecture_date, day_index, start_hour, duration")
      .eq("course_id", courseId);
    if (error) failWith(error, "Failed to fetch class schedule");
    return data;
  }

  /** The institution's single settings row (session, minimum attendance %, expected classes). */
  static async #fetchSettings() {
    // select("*") + a fallback in the caller, so this keeps working until
    // the expected_classes_per_semester migration has been run.
    const { data, error } = await supabaseAdmin.from("system_settings").select("*").eq("id", 1).single();
    if (error) failWith(error, "Failed to fetch system settings");
    return data;
  }

  /**
   * The course's average attendance, held-session count and at-risk student
   * count for the current academic session — the same rules
   * `courseStatsService` applies to every course at once, scoped to one.
   */
  static async #computeAttendance({ courseId, courseCode, enrolledIds, settings }) {
    const { data: academicSession } = await supabaseAdmin
      .from("academic_sessions")
      .select("start_date, end_date")
      .eq("name", settings.academic_year)
      .maybeSingle();

    const sessions = await fetchAllPages(() => {
      let query = supabaseAdmin
        .from("class_sessions")
        .select("id, course_id, status, session_date, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at")
        .eq("course_id", courseId)
        .eq("status", "ENDED")
        .order("id");
      // A session with no row (or open-ended dates) simply isn't filtered on that side.
      if (academicSession?.start_date) query = query.gte("session_date", academicSession.start_date);
      if (academicSession?.end_date) query = query.lte("session_date", academicSession.end_date);
      return query;
    }, "Failed to fetch class sessions");

    const attendanceRows = await fetchInChunks(
      sessions.map((session) => session.id),
      (idChunk) =>
        supabaseAdmin
          .from("session_attendance")
          .select("class_session_id, student_id, status")
          .in("class_session_id", idChunk)
          .order("class_session_id")
          .order("student_id"),
      "Failed to fetch session attendance"
    );

    const attendance = computeCourseAttendance({
      sessions,
      attendanceRows,
      enrolledStudentIds: enrolledIds,
      expectedClasses: settings.expected_classes_per_semester ?? DEFAULT_EXPECTED_CLASSES,
      asOf: new Date(),
      // Without this `studentsAtRisk` comes back null — it's what the stat
      // cards' "students at risk" number is built on.
      minPercent: Number(settings.min_attendance_percentage),
    });

    // TEMPORARY DEBUG LOG — remove once the overview's numbers are confirmed.
    console.log("[course-details] average attendance", {
      course: courseCode,
      avgAttendancePercentage: attendance.percent,
      studentsAtRisk: attendance.studentsAtRisk,
      heldSessions: attendance.heldSessions,
      enrolledStudents: enrolledIds.length,
      endedSessionsInTerm: sessions.length,
      attendanceRows: attendanceRows.length,
      termWindow: academicSession ? `${academicSession.start_date} → ${academicSession.end_date}` : "none",
    });

    return attendance;
  }
}

export default CourseDetails;
