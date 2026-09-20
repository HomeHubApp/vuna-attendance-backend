import { supabaseAdmin } from "../config/supabase.js";

// Backs GET/POST /students/me/courses* — a student's own course list,
// merging course_eligibility (which (department, level) pairs can see a
// course) against their own enrollments row (if any) for each, plus
// self-service enroll/unenroll.
//
// Distinct from enrollmentService.js's older getEligibleCourses/enroll,
// which check eligibility directly against courses.department_id (the
// OWNING department) rather than course_eligibility — that direct check
// is exactly the ownership-vs-eligibility conflation this resource exists
// to fix, so a cross-listed course (e.g. MATH101, owned by Mathematics
// but eligible for 100-level Engineering/Computing too) shows up here for
// every eligible department, not just its own.
class StudentCourse {
  static async getStudentProfile(studentUserId) {
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("department_id, current_level")
      .eq("user_id", studentUserId)
      .single();

    if (error || !student) {
      const err = new Error("Student record not found");
      err.statusCode = 404;
      throw err;
    }

    return student;
  }

  // Every course this student is eligible for (department + level match
  // against course_eligibility), each with an enrollment_status of
  // ENROLLED, UNENROLLED (explicitly unenrolled — a row exists), or
  // NOT_ENROLLED (no row exists at all).
  static async getMyCourses(studentUserId) {
    const student = await StudentCourse.getStudentProfile(studentUserId);

    const { data: eligibleRows, error: eligibilityError } = await supabaseAdmin
      .from("course_eligibility")
      .select("course_id, courses(id, course_code, course_name)")
      .eq("department_id", student.department_id)
      .eq("level", Number(student.current_level));

    if (eligibilityError) {
      const err = new Error(eligibilityError.message);
      err.statusCode = 500;
      throw err;
    }

    if (!eligibleRows.length) return [];

    const courseIds = eligibleRows.map((row) => row.course_id);

    const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
      .from("enrollments")
      .select("course_id, status")
      .eq("student_id", studentUserId)
      .in("course_id", courseIds);

    if (enrollmentsError) {
      const err = new Error(enrollmentsError.message);
      err.statusCode = 500;
      throw err;
    }

    const statusByCourseId = new Map(enrollments.map((row) => [row.course_id, row.status]));

    return eligibleRows
      // A course_eligibility row can outlive its course (no ON DELETE
      // CASCADE race in practice, but the embed comes back null if the
      // course was since deleted) — skip those rather than render a blank row.
      .filter((row) => row.courses)
      .map((row) => ({
        course_id: row.course_id,
        course_code: row.courses.course_code,
        course_name: row.courses.course_name,
        enrollment_status: statusByCourseId.get(row.course_id) ?? "NOT_ENROLLED",
      }));
  }

  // Enrolls the student in a course they're eligible for. Idempotent:
  // already-ENROLLED returns success as-is; a prior UNENROLLED row is
  // flipped back rather than duplicated (respects the unique constraint
  // on (student_id, course_id)).
  static async enroll(courseId, studentUserId) {
    if (!courseId) {
      const err = new Error("courseId is required");
      err.statusCode = 400;
      throw err;
    }

    const student = await StudentCourse.getStudentProfile(studentUserId);

    const { data: eligibility, error: eligibilityError } = await supabaseAdmin
      .from("course_eligibility")
      .select("id")
      .eq("course_id", courseId)
      .eq("department_id", student.department_id)
      .eq("level", Number(student.current_level))
      .maybeSingle();

    if (eligibilityError) {
      const err = new Error(eligibilityError.message);
      err.statusCode = 500;
      throw err;
    }

    if (!eligibility) {
      const err = new Error("You are not eligible to enroll in this course");
      err.statusCode = 403;
      throw err;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("student_id", studentUserId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingError) {
      const err = new Error(existingError.message);
      err.statusCode = 500;
      throw err;
    }

    if (existing) {
      if (existing.status === "ENROLLED") return existing;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("enrollments")
        .update({ status: "ENROLLED", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
      }
      return updated;
    }

    const { data: created, error: createError } = await supabaseAdmin
      .from("enrollments")
      .insert({
        student_id: studentUserId,
        course_id: courseId,
        status: "ENROLLED",
        source: "SELF",
      })
      .select()
      .single();

    if (createError) {
      const err = new Error(createError.message);
      err.statusCode = 500;
      throw err;
    }

    return created;
  }

  // Flips an existing enrollment row's status to UNENROLLED — never
  // deletes it, since attendance may already be recorded against it and
  // the history matters once portal sync exists. No-op success if no row
  // exists at all.
  static async unenroll(courseId, studentUserId) {
    if (!courseId) {
      const err = new Error("courseId is required");
      err.statusCode = 400;
      throw err;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("enrollments")
      .select("id, status")
      .eq("student_id", studentUserId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingError) {
      const err = new Error(existingError.message);
      err.statusCode = 500;
      throw err;
    }

    if (!existing) {
      return { message: "Not enrolled in this course" };
    }

    if (existing.status === "UNENROLLED") {
      return existing;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("enrollments")
      .update({ status: "UNENROLLED", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      const err = new Error(updateError.message);
      err.statusCode = 500;
      throw err;
    }

    return updated;
  }
}

export default StudentCourse;
