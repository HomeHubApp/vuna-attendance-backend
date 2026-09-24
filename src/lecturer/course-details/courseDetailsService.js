/**
 * @file Gathers the rows behind the Course Details page and hands them to the
 * pure logic in `courseDetailsCalculations.js`.
 *
 * @remarks
 * The Course Details page is built in parts, each with its own endpoint, all
 * under `/api/course-details` and all in this folder. `getOverview` is the
 * header (course dropdown, facts line, exam-rule line, average-attendance
 * badge) AND the three stat cards under it, in one call — they share every
 * input (the course, its enrolled students, its attendance figures), so one
 * round trip and one loading state serve both. `getAttendanceMatrix` is the
 * student-by-session table under them: separate because it is by far the
 * heaviest read (every attendance row of the term, plus the problem checks),
 * so it has its own endpoint and loading state and never holds the header up.
 * The "Notify at-risk students" action is the one write; it lives in
 * `atRiskNotificationService.js` and reads its recipients from
 * `getAttendanceMatrix`, so the students warned are the ones the table marks.
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
import { UNRESOLVED_ISSUE_FILTER } from "../../shared/analytics/attendanceBuckets.js";
import {
  DEFAULT_EXPECTED_CLASSES,
  computeCourseAttendance,
  computeStudentPresentCounts,
  minClassesForExam,
} from "../../shared/analytics/attendanceCalculations.js";
import { failWith, fetchAllPages, fetchInChunks } from "../../shared/analytics/supabasePaging.js";
import { buildAttendanceMatrixRows, buildMatrixSessions } from "./attendanceMatrixCalculations.js";
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

  /**
   * The attendance matrix for one of the lecturer's courses: a column per
   * held session this term and a row per enrolled student, each with their
   * status in every column, their attendance percentage and where they stand
   * on exam eligibility.
   *
   * @param {string} lecturerId - auth user id of the logged-in lecturer.
   * @param {string} courseId - The course. Required (unlike the overview, no
   *   default): the frontend knows it by the time it asks, and requiring it
   *   means this call can never describe a different course from the header.
   * @returns {Promise<{
   *   courseId: string,
   *   rules: { minPercentageForExam: number, minClassesForExam: number, expectedClasses: number },
   *   sessions: ReturnType<typeof buildMatrixSessions>,
   *   students: ReturnType<typeof buildAttendanceMatrixRows>
   * }>}
   *   `sessions` is empty until a class has been held; `students` still lists
   *   everyone enrolled (all at 0%, none at risk).
   * @throws {Error} 400 when `courseId` is missing; 404 when it isn't one of
   *   the lecturer's courses — whether it doesn't exist or belongs to someone
   *   else, so a lecturer can't probe for other people's course ids.
   */
  static async getAttendanceMatrix(lecturerId, courseId) {
    if (!courseId) fail("courseId is required", 400);

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("lecturer_id", lecturerId)
      .maybeSingle();
    if (courseError) failWith(courseError, "Failed to fetch course");
    if (!course) fail("Course not found", 404);

    const [enrolledIds, settings] = await Promise.all([
      CourseDetails.#fetchEnrolledStudentIds(courseId),
      CourseDetails.#fetchSettings(),
    ]);
    const expectedClasses = settings.expected_classes_per_semester ?? DEFAULT_EXPECTED_CLASSES;
    const minPercent = Number(settings.min_attendance_percentage);

    const term = await CourseDetails.#fetchTermWindow(settings);
    const sessions = await CourseDetails.#fetchEndedTermSessions(courseId, term);
    const attendanceRows = await CourseDetails.#fetchAttendanceRows(sessions);

    const { presentByStudent, heldSessionIds } = computeStudentPresentCounts({
      sessions,
      attendanceRows,
      enrolledStudentIds: enrolledIds,
      asOf: new Date(),
    });
    const matrixSessions = buildMatrixSessions({ sessions, heldSessionIds, termStartDate: term?.start_date });

    // Only enrolled students' rows in held sessions can show up in a cell, so
    // only those are worth looking up problem checks for.
    const enrolledIdSet = new Set(enrolledIds);
    const cellRows = attendanceRows.filter((row) => heldSessionIds.has(row.class_session_id) && enrolledIdSet.has(row.student_id));

    const [enrolledStudents, levelByStudent, checksByAttendanceId] = await Promise.all([
      CourseDetails.#fetchStudentIdentities(enrolledIds),
      CourseDetails.#fetchLevels(enrolledIds),
      CourseDetails.#fetchProblemChecks(cellRows),
    ]);

    return {
      courseId,
      rules: {
        minPercentageForExam: minPercent,
        minClassesForExam: minClassesForExam(expectedClasses, minPercent),
        expectedClasses,
      },
      sessions: matrixSessions,
      students: buildAttendanceMatrixRows({
        enrolledStudents,
        levelByStudent,
        matrixSessions,
        attendanceRows: cellRows,
        checksByAttendanceId,
        presentByStudent,
        expectedClasses,
        minPercent,
      }),
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

  /** The current academic session's `{ start_date, end_date }`, or null when settings name none (a null side simply isn't filtered on). */
  static async #fetchTermWindow(settings) {
    const { data } = await supabaseAdmin
      .from("academic_sessions")
      .select("start_date, end_date")
      .eq("name", settings.academic_year)
      .maybeSingle();
    return data;
  }

  /** The course's ENDED `class_sessions` whose date falls inside the term window. */
  static async #fetchEndedTermSessions(courseId, term) {
    return fetchAllPages(() => {
      let query = supabaseAdmin
        .from("class_sessions")
        .select("id, course_id, status, session_date, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at")
        .eq("course_id", courseId)
        .eq("status", "ENDED")
        .order("id");
      if (term?.start_date) query = query.gte("session_date", term.start_date);
      if (term?.end_date) query = query.lte("session_date", term.end_date);
      return query;
    }, "Failed to fetch class sessions");
  }

  /** Every `session_attendance` row of the given sessions (paged and chunked past PostgREST's 1000-row cap). */
  static async #fetchAttendanceRows(sessions) {
    return fetchInChunks(
      sessions.map((session) => session.id),
      (idChunk) =>
        supabaseAdmin
          .from("session_attendance")
          .select("id, class_session_id, student_id, status")
          .in("class_session_id", idChunk)
          .order("class_session_id")
          .order("student_id"),
      "Failed to fetch session attendance"
    );
  }

  /** Name and matric number of each student, from `users`. */
  static async #fetchStudentIdentities(studentIds) {
    return fetchInChunks(
      studentIds,
      (idChunk) => supabaseAdmin.from("users").select("id, full_name, institution_identifier").in("id", idChunk).order("id"),
      "Failed to fetch students"
    );
  }

  /** Each student's `current_level`, by user id (null when they have no `students` row or no level). */
  static async #fetchLevels(studentIds) {
    const rows = await fetchInChunks(
      studentIds,
      (idChunk) => supabaseAdmin.from("students").select("user_id, current_level").in("user_id", idChunk).order("user_id"),
      "Failed to fetch student levels"
    );
    return new Map(rows.map((row) => [row.user_id, row.current_level ?? null]));
  }

  /**
   * The unresolved problem checks of the given `session_attendance` rows,
   * keyed by row id — the only checks that can turn a "present" cell into
   * "incomplete". Narrowed in the database (see `UNRESOLVED_ISSUE_FILTER`)
   * because a course's full check log is thousands of rows the matrix never
   * needs, and only PRESENT/LATE rows are asked about since no other status
   * looks at checks.
   */
  static async #fetchProblemChecks(attendanceRows) {
    const presentRowIds = attendanceRows.filter((row) => row.status === "PRESENT" || row.status === "LATE").map((row) => row.id);
    const checks = await fetchInChunks(
      presentRowIds,
      (idChunk) =>
        supabaseAdmin
          .from("attendance_checks")
          .select("id, session_attendance_id, resolved, overall_match, gps_outcome, ip_outcome")
          .in("session_attendance_id", idChunk)
          .not("resolved", "is", true)
          .or(UNRESOLVED_ISSUE_FILTER)
          .order("id"),
      "Failed to fetch attendance checks"
    );

    const byAttendanceId = new Map();
    for (const check of checks) {
      if (!byAttendanceId.has(check.session_attendance_id)) byAttendanceId.set(check.session_attendance_id, []);
      byAttendanceId.get(check.session_attendance_id).push(check);
    }
    return byAttendanceId;
  }

  /**
   * The course's average attendance, held-session count and at-risk student
   * count for the current academic session — the same rules
   * `courseStatsService` applies to every course at once, scoped to one.
   */
  static async #computeAttendance({ courseId, courseCode, enrolledIds, settings }) {
    const academicSession = await CourseDetails.#fetchTermWindow(settings);
    const sessions = await CourseDetails.#fetchEndedTermSessions(courseId, academicSession);
    const attendanceRows = await CourseDetails.#fetchAttendanceRows(sessions);

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
