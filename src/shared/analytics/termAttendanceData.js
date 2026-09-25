/**
 * @file Reads, in one place, the rows every "how is attendance going across
 * my courses" screen is built from: the institution's settings and current
 * academic session, and for a set of courses their ended class sessions in
 * that session, their enrolled students and every attendance row of those
 * sessions.
 *
 * @remarks
 * Shared by the lecturer's per-course stats
 * (`lecturer/courses/courseStatsService.js`, the Courses page) and the
 * Dashboard (`lecturer/dashboard/`), which needs the same rows for its
 * averages, at-risk counts, weekly chart and review queue. Reading them once
 * per request, with one set of rules, is the point: a course's numbers can't
 * differ between two screens because one of them filtered differently.
 *
 * The rules are the ones the app uses everywhere: only sessions inside the
 * current academic session's date window, only ENDED sessions (whether one
 * counts as "held" is decided later by `isSessionHeld`), and only ENROLLED
 * students — students who merely match a course's department and level are not
 * counted. Everything goes through `supabasePaging` because a lecturer's
 * attendance history runs well past PostgREST's 1000-row default cap.
 *
 * It returns raw rows and settings, no maths — that is
 * `attendanceCalculations.js`. It reads the whole term each time (no cache), so
 * cost grows with the number of courses and sessions; if that bites, the next
 * step is to cache per lecturer for a few seconds or to keep running totals in
 * a table.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import { DEFAULT_EXPECTED_CLASSES } from "./attendanceCalculations.js";
import { failWith, fetchAllPages, fetchInChunks } from "./supabasePaging.js";

/**
 * The institution's single settings row, with the two numbers the attendance
 * rules need pulled out.
 *
 * @returns {Promise<{ settings: object, expectedClasses: number, minPercent: number }>}
 */
export async function fetchAttendanceSettings() {
  const { data: settings, error } = await supabaseAdmin.from("system_settings").select("*").eq("id", 1).single();
  if (error) failWith(error, "Failed to fetch system settings");

  return {
    settings,
    // select("*") + a fallback so this keeps working until the
    // expected_classes_per_semester migration has been run.
    expectedClasses: settings.expected_classes_per_semester ?? DEFAULT_EXPECTED_CLASSES,
    minPercent: Number(settings.min_attendance_percentage),
  };
}

/**
 * The current academic session's date window. A session with no row (or
 * open-ended dates) simply isn't filtered on that side.
 *
 * @param {{ academic_year: string }} settings
 * @returns {Promise<{ start_date: string|null, end_date: string|null }|null>}
 */
export async function fetchTermWindow(settings) {
  const { data } = await supabaseAdmin
    .from("academic_sessions")
    .select("start_date, end_date")
    .eq("name", settings.academic_year)
    .maybeSingle();
  return data;
}

/**
 * Every ENDED class session of the given courses whose date falls inside the term window.
 *
 * @param {string[]} courseIds
 * @param {{ start_date?: string|null, end_date?: string|null }|null} term
 * @returns {Promise<object[]>} `class_sessions` rows.
 */
export async function fetchEndedTermSessions(courseIds, term) {
  return fetchAllPages(() => {
    let query = supabaseAdmin
      .from("class_sessions")
      .select("id, course_id, class_schedule_id, status, session_date, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at")
      .in("course_id", courseIds)
      .eq("status", "ENDED")
      .order("id");
    if (term?.start_date) query = query.gte("session_date", term.start_date);
    if (term?.end_date) query = query.lte("session_date", term.end_date);
    return query;
  }, "Failed to fetch class sessions");
}

/**
 * The ENROLLED students of the given courses.
 *
 * @param {string[]} courseIds
 * @returns {Promise<Array<{ course_id: string, student_id: string }>>}
 */
export async function fetchEnrollments(courseIds) {
  return fetchAllPages(
    () =>
      supabaseAdmin
        .from("enrollments")
        .select("course_id, student_id")
        .in("course_id", courseIds)
        .eq("status", "ENROLLED")
        .order("course_id")
        .order("student_id"),
    "Failed to fetch enrollments"
  );
}

/**
 * Every attendance row of the given sessions.
 *
 * @param {Array<{ id: string }>} sessions
 * @returns {Promise<Array<{ id: string, class_session_id: string, student_id: string, status: string, join_time: string|null, overridden_at: string|null }>>}
 *   `overridden_at` is set once a lecturer has ruled on the row (see
 *   `overrideAttendance`); the review queue uses it to know what is still pending.
 */
export async function fetchSessionAttendanceRows(sessions) {
  return fetchInChunks(
    sessions.map((session) => session.id),
    (idChunk) =>
      supabaseAdmin
        .from("session_attendance")
        .select("id, class_session_id, student_id, status, join_time, overridden_at")
        .in("class_session_id", idChunk)
        .order("class_session_id")
        .order("student_id"),
    "Failed to fetch session attendance"
  );
}

/**
 * Everything the cross-course attendance screens are built from, in one call.
 *
 * @param {string[]} courseIds - The courses to read (a lecturer's own).
 * @returns {Promise<{
 *   settings: object, expectedClasses: number, minPercent: number,
 *   term: { start_date: string|null, end_date: string|null }|null,
 *   sessions: object[], enrollments: object[], attendanceRows: object[]
 * }>}
 */
export async function fetchTermAttendanceData(courseIds) {
  const { settings, expectedClasses, minPercent } = await fetchAttendanceSettings();
  const term = await fetchTermWindow(settings);
  const sessions = await fetchEndedTermSessions(courseIds, term);
  const [enrollments, attendanceRows] = await Promise.all([fetchEnrollments(courseIds), fetchSessionAttendanceRows(sessions)]);

  return { settings, expectedClasses, minPercent, term, sessions, enrollments, attendanceRows };
}
