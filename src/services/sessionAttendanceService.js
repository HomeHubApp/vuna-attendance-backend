import { supabaseAdmin } from "../config/supabase.js";

const LATE_THRESHOLD_MINUTES = process.env.LATE_THRESHOLD_MINUTES
  ? parseInt(process.env.LATE_THRESHOLD_MINUTES, 10)
  : 15;

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

    // can only join a session for a course they're actually enrolled in.
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("course_id", session.course_id)
      .maybeSingle();

    if (enrollmentError) {
      const err = new Error(enrollmentError.message);
      err.statusCode = 500;
      throw err;
    }

    if (!enrollment) {
      const err = new Error("You are not enrolled in this course");
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
}

export default SessionAttendance;
