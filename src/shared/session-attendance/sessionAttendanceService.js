/**
 * @file A student's participation in one live class session: joining it, a
 * lecturer's roster of who joined, the student's own list of
 * currently-active attendance (what the check-in loop polls), and a
 * lecturer's manual override of a student's status after the fact.
 *
 * @remarks
 * Lives in `shared/` because `student/session-attendance/sessionAttendanceRoutes.js`
 * (join, mine/active) and `lecturer/session-attendance/sessionAttendanceRoutes.js`
 * (the roster view, and `overrideAttendance`) both call into this one
 * service. `overrideAttendance` is lecturer-only in practice today, but it
 * lives here rather than under `lecturer/` to keep every operation on this
 * table in one place, the way `courseService.js`'s Admin-only writes still
 * live in `shared/courses/`.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import { CHECK_INTERVAL_MINUTES } from "../../config/attendancePolicy.js";

// Exported so lecturer/roster/rosterService.js can classify "Late Joined" the
// same way join time itself decides PRESENT vs LATE — one threshold, not two.
export const LATE_THRESHOLD_MINUTES = process.env.LATE_THRESHOLD_MINUTES
  ? parseInt(process.env.LATE_THRESHOLD_MINUTES, 10)
  : 15;

/** The only statuses a row is allowed to hold — matches the database's own CHECK constraint. */
const VALID_OVERRIDE_STATUSES = new Set(["PRESENT", "LATE", "FLAGGED", "ABSENT", "LEFT_EARLY"]);

class SessionAttendance {
  static async joinSession(
    { class_session_id, latitude, longitude, ip_address, device_id },
    studentId,
  ) {
    if (!class_session_id) {
      const err = new Error("class_session_id is required");
      err.statusCode = 400;
      throw err;
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("class_sessions")
      .select("id, status, actual_start_at, course_id")
      .eq("id", class_session_id)
      .single();

    if (sessionError || !session) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }

    if (session.status !== "ACTIVE") {
      const err = new Error("This session is not currently active");
      err.statusCode = 400;
      throw err;
    }

    // Eligibility is by department + level match, not a literal
    // enrollments row — the same basis enrollmentService.js's
    // getEligibleCourses and classScheduleService.js's
    // getMyScheduleAsStudent already use. There's no student-initiated
    // "enroll" step exercised anywhere in the app yet (MyCoursesService
    // just shows eligible courses directly), so requiring a real
    // enrollments row here would 403 every student unconditionally.
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("department_id, current_level")
      .eq("user_id", studentId)
      .single();

    if (studentError || !student) {
      const err = new Error("Student record not found");
      err.statusCode = 404;
      throw err;
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("department_id, level")
      .eq("id", session.course_id)
      .single();

    if (courseError || !course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    if (course.department_id !== student.department_id || course.level !== Number(student.current_level)) {
      const err = new Error("You are not eligible to join this session");
      err.statusCode = 403;
      throw err;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("session_attendance")
      .select("*")
      .eq("class_session_id", class_session_id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existingError) {
      const err = new Error(existingError.message);
      err.statusCode = 500;
      throw err;
    }

    if (existing) {
      return { ...existing, message: "You have already joined this session" };
    }

    const minutesSinceStart =
      (Date.now() - new Date(session.actual_start_at).getTime()) / 60000;
    const status =
      minutesSinceStart > LATE_THRESHOLD_MINUTES ? "LATE" : "PRESENT";

    const { data: created, error: createError } = await supabaseAdmin
      .from("session_attendance")
      .insert({
        class_session_id,
        student_id: studentId,
        status,
        device_id: device_id ?? null,
        initial_lat: latitude ?? null,
        initial_lng: longitude ?? null,
        initial_ip_address: ip_address ?? null,
      })
      .select()
      .single();

    if (createError) {
      const err = new Error(createError.message);
      err.statusCode = 500;
      throw err;
    }

    await SessionAttendance.recomputeHeadcount(class_session_id);

    return created;
  }

  static async recomputeHeadcount(class_session_id) {
    const { count, error } = await supabaseAdmin
      .from("session_attendance")
      .select("id", { count: "exact", head: true })
      .eq("class_session_id", class_session_id)
      .in("status", ["PRESENT", "LATE"]);

    if (error) return; // non-fatal — headcount is a display convenience, not core correctness

    await supabaseAdmin
      .from("class_sessions")
      .update({ live_headcount: count ?? 0 })
      .eq("id", class_session_id);
  }

  // The logged-in student's own attendance rows for sessions that are
  // still ACTIVE, each with when its next verification check-in is due — so
  // the student's device knows which sessions to keep verifying and when,
  // without hard-coding the interval client-side. `next_check_due_at` is
  // null when no check has happened yet (the first one is due immediately;
  // the missed-check monitor's grace window runs from join_time).
  static async getMyActiveAttendance(studentId) {
    const { data: rows, error } = await supabaseAdmin
      .from("session_attendance")
      .select(
        "id, class_session_id, status, join_time, consecutive_failed_checks, class_sessions!inner(status, scheduled_end_at, courses(course_code, course_name), venues(name))",
      )
      .eq("student_id", studentId)
      .eq("class_sessions.status", "ACTIVE");

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    if (!rows.length) return { attendance: [], check_interval_minutes: CHECK_INTERVAL_MINUTES };

    const { data: checks, error: checksError } = await supabaseAdmin
      .from("attendance_checks")
      .select("session_attendance_id, checked_at")
      .in("session_attendance_id", rows.map((row) => row.id))
      .order("checked_at", { ascending: false });

    if (checksError) {
      const err = new Error(checksError.message);
      err.statusCode = 500;
      throw err;
    }

    const lastCheckedAt = new Map();
    for (const check of checks) {
      if (!lastCheckedAt.has(check.session_attendance_id)) {
        lastCheckedAt.set(check.session_attendance_id, check.checked_at);
      }
    }

    const attendance = rows.map((row) => {
      const last = lastCheckedAt.get(row.id) ?? null;
      return {
        attendance_id: row.id,
        class_session_id: row.class_session_id,
        status: row.status,
        join_time: row.join_time,
        consecutive_failed_checks: row.consecutive_failed_checks,
        scheduled_end_at: row.class_sessions.scheduled_end_at,
        course_code: row.class_sessions.courses?.course_code ?? null,
        course_name: row.class_sessions.courses?.course_name ?? null,
        venue_name: row.class_sessions.venues?.name ?? null,
        last_checked_at: last,
        next_check_due_at: last ? new Date(new Date(last).getTime() + CHECK_INTERVAL_MINUTES * 60000).toISOString() : null,
      };
    });

    return { attendance, check_interval_minutes: CHECK_INTERVAL_MINUTES };
  }

  static async getSessionAttendance(class_session_id, lecturerId) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("class_sessions")
      .select("id, lecturer_id")
      .eq("id", class_session_id)
      .single();

    if (sessionError || !session) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }

    if (session.lecturer_id !== lecturerId) {
      const err = new Error("You did not start this session");
      err.statusCode = 403;
      throw err;
    }

    const { data: attendance, error } = await supabaseAdmin
      .from("session_attendance")
      .select("*")
      .eq("class_session_id", class_session_id)
      .order("join_time", { ascending: true });

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    if (!attendance.length) return attendance;

    const studentIds = attendance.map((a) => a.student_id);
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, institution_identifier")
      .in("id", studentIds);

    if (usersError) {
      const err = new Error(usersError.message);
      err.statusCode = 500;
      throw err;
    }

    const userMap = new Map(users.map((u) => [u.id, u]));

    return attendance.map((row) => ({
      ...row,
      full_name: userMap.get(row.student_id)?.full_name,
      institution_identifier: userMap.get(row.student_id)
        ?.institution_identifier,
    }));
  }

  /**
   * A lecturer's manual override of one student's status for one session —
   * the mutation behind the roster's Override action. Creates the
   * `session_attendance` row when the student never joined at all (e.g. "a
   * physical register confirms they were present"), or updates it when one
   * already exists. Either way, `override_reason`/`overridden_by`/
   * `overridden_at` are stamped and never cleared — see
   * `Schemas/session_attendance_override_schema.sql` for why those columns
   * exist rather than reusing `attendance_checks.resolution_note` (that
   * column is scoped to one check, and a never-joined student has none).
   *
   * Any of that row's still-unresolved `attendance_checks` are marked
   * resolved with the same reason and attribution, so a future per-check
   * audit view doesn't keep showing an issue the lecturer has already ruled
   * on.
   *
   * @param {string} classSessionId - The session whose roster this belongs to.
   * @param {string} studentId - The student being overridden.
   * @param {{ status: string, reason: string }} payload - The new status
   *   (must be a real `session_attendance.status` value — there is no
   *   "Incomplete" status to override to, see `rosterCalculations.js`) and
   *   the reason, permanently attributed to the acting lecturer.
   * @param {string} lecturerId - auth user id of the lecturer performing the override.
   * @returns {Promise<object>} The resulting `session_attendance` row.
   */
  static async overrideAttendance(classSessionId, studentId, { status, reason }, lecturerId) {
    if (!VALID_OVERRIDE_STATUSES.has(status)) {
      const err = new Error(`status must be one of: ${[...VALID_OVERRIDE_STATUSES].join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    if (!reason || reason.trim().length < 20) {
      const err = new Error("reason must be at least 20 characters");
      err.statusCode = 400;
      throw err;
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("class_sessions")
      .select("id, lecturer_id, course_id")
      .eq("id", classSessionId)
      .single();

    if (sessionError || !session) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }

    if (session.lecturer_id !== lecturerId) {
      const err = new Error("You did not start this session");
      err.statusCode = 403;
      throw err;
    }

    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("course_id", session.course_id)
      .eq("student_id", studentId)
      .eq("status", "ENROLLED")
      .maybeSingle();

    if (enrollmentError) {
      const err = new Error(enrollmentError.message);
      err.statusCode = 500;
      throw err;
    }
    if (!enrollment) {
      const err = new Error("This student is not enrolled in the session's course");
      err.statusCode = 404;
      throw err;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("session_attendance")
      .select("id")
      .eq("class_session_id", classSessionId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existingError) {
      const err = new Error(existingError.message);
      err.statusCode = 500;
      throw err;
    }

    const overriddenAt = new Date().toISOString();
    const overrideFields = { status, override_reason: reason, overridden_by: lecturerId, overridden_at: overriddenAt };

    const { data: row, error: writeError } = existing
      ? await supabaseAdmin
          .from("session_attendance")
          .update({ ...overrideFields, updated_at: overriddenAt })
          .eq("id", existing.id)
          .select()
          .single()
      : await supabaseAdmin
          .from("session_attendance")
          .insert({ class_session_id: classSessionId, student_id: studentId, ...overrideFields })
          .select()
          .single();

    if (writeError) {
      const err = new Error(writeError.message);
      err.statusCode = 500;
      throw err;
    }

    if (existing) {
      // Housekeeping, not core correctness — a future per-check audit view
      // shouldn't keep showing a problem the lecturer has already ruled on.
      // Non-fatal: the override itself already succeeded above.
      await supabaseAdmin
        .from("attendance_checks")
        .update({ resolved: true, resolved_by: lecturerId, resolved_at: overriddenAt, resolution_note: reason })
        .eq("session_attendance_id", existing.id)
        .eq("resolved", false);
    }

    return row;
  }
}

export default SessionAttendance;
