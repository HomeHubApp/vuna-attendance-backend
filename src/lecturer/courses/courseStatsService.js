/**
 * @file Gathers the rows behind `GET /api/courses/mine/stats` (a lecturer's
 * per-course enrolment, attendance and exam-eligibility numbers) and hands
 * them to the pure maths in `shared/analytics/attendanceCalculations.js`. The
 * rows themselves come from `shared/analytics/termAttendanceData.js`.
 *
 * @remarks
 * Lecturer-only (guarded by `requireRole("Lecturer")` in
 * `lecturer/courses/courseRoutes.js`), so it lives beside that role rather
 * than in `shared/` — unlike the maths it calls, which other roles will
 * eventually need too.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import {
  computeAttendanceTrend,
  computeCourseAttendance,
  minClassesForExam,
} from "../../shared/analytics/attendanceCalculations.js";
import { failWith } from "../../shared/analytics/supabasePaging.js";
import { fetchTermAttendanceData } from "../../shared/analytics/termAttendanceData.js";

const groupBy = (rows, key) => {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return groups;
};

class CourseStats {
  /**
   * Enrolment size, semester attendance and week-on-week trend for every
   * course the lecturer teaches — the data behind the "All Course
   * Offerings" table. The maths itself lives in
   * utils/attendanceCalculations.js; this only gathers rows.
   *
   * Counted: sessions inside the current academic session's date window,
   * and students whose enrollment status is ENROLLED. Students who merely
   * match the course's department + level do NOT count.
   *
   * @param {string} lecturerId - auth user id of the logged-in lecturer.
   * @returns {Promise<Array<{
   *   course_id: string,
   *   enrolled_students: number,
   *   attendance_percent: number|null,
   *   previous_attendance_percent: number|null,
   *   trend_delta: number|null,
   *   held_sessions: number,
   *   expected_classes: number,
   *   min_classes_for_exam: number,
   *   students_at_risk: number
   * }>>}
   *   min_classes_for_exam is the fewest attended classes that reach the
   *   institution's minimum attendance; students_at_risk is how many
   *   enrolled students can no longer reach it (see canStillQualify in
   *   utils/attendanceCalculations.js).
   */
  static async getMyCourseStats(lecturerId, now = new Date()) {
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("lecturer_id", lecturerId);
    if (coursesError) failWith(coursesError, "Failed to fetch courses");
    if (!courses.length) return [];
    const courseIds = courses.map((course) => course.id);

    // The settings, current academic session and every session / enrollment /
    // attendance row of these courses, read by the shared loader the Dashboard
    // uses too — so both screens count the same rows the same way.
    const { expectedClasses, minPercent, sessions, enrollments, attendanceRows } = await fetchTermAttendanceData(courseIds);

    const sessionsByCourse = groupBy(sessions, "course_id");
    const enrollmentsByCourse = groupBy(enrollments, "course_id");
    const attendanceBySession = groupBy(attendanceRows, "class_session_id");

    return courseIds.map((courseId) => {
      const courseSessions = sessionsByCourse.get(courseId) ?? [];
      const enrolledStudentIds = (enrollmentsByCourse.get(courseId) ?? []).map((row) => row.student_id);
      const courseAttendance = courseSessions.flatMap((session) => attendanceBySession.get(session.id) ?? []);

      const args = { sessions: courseSessions, attendanceRows: courseAttendance, enrolledStudentIds, expectedClasses };
      const trend = computeAttendanceTrend(args, now);
      const { heldSessions, studentsAtRisk } = computeCourseAttendance({ ...args, asOf: now, minPercent });

      return {
        course_id: courseId,
        enrolled_students: enrolledStudentIds.length,
        attendance_percent: trend.current,
        previous_attendance_percent: trend.previous,
        trend_delta: trend.delta,
        held_sessions: heldSessions,
        expected_classes: expectedClasses,
        min_classes_for_exam: minClassesForExam(expectedClasses, minPercent),
        students_at_risk: studentsAtRisk,
      };
    });
  }
}

export default CourseStats;
