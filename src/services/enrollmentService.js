import { supabaseAdmin } from "../config/supabase.js";

class Enrollment {
  static async getEligibleCourses(studentId) {
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

    const { data: courses, error: coursesError } = await supabaseAdmin
      .from("courses")
      .select("id, course_code, course_name, credit_unit, level, department_id")
      .eq("department_id", student.department_id)
      .eq("level", student.current_level);

    if (coursesError) {
      const err = new Error(coursesError.message);
      err.statusCode = 500;
      throw err;
    }

    return courses;
  }

  static async enroll(course_id, studentId) {
    if (!course_id) {
      const err = new Error("course_id is required");
      err.statusCode = 400;
      throw err;
    }

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
      .select("id, department_id, level")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }


    if (course.department_id !== student.department_id || course.level !== student.current_level) {
      const err = new Error("You are not eligible to enroll in this course");
      err.statusCode = 403;
      throw err;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("student_id", studentId)
      .eq("course_id", course_id)
      .maybeSingle();

    if (existingError) {
      const err = new Error(existingError.message);
      err.statusCode = 500;
      throw err;
    }

    if (existing) {
      return { ...existing, message: "You are already enrolled in this course" };
    }

    const { data: created, error: createError } = await supabaseAdmin
      .from("enrollments")
      .insert({ student_id: studentId, course_id })
      .select()
      .single();

    if (createError) {
      const err = new Error(createError.message);
      err.statusCode = 500;
      throw err;
    }

    return created;
  }

  static async getMyEnrollments(studentId) {
    const { data, error } = await supabaseAdmin
      .from("enrollments")
      .select("*, courses(course_code, course_name, credit_unit, level)")
      .eq("student_id", studentId);

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  static async getCourseRoster(course_id, lecturerId) {
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, lecturer_id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    if (course.lecturer_id !== lecturerId) {
      const err = new Error("You do not teach this course");
      err.statusCode = 403;
      throw err;
    }

    const { data: enrollments, error } = await supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("course_id", course_id);

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    if (!enrollments.length) return enrollments;

    const studentIds = enrollments.map((e) => e.student_id);
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

    return enrollments.map((row) => ({
      ...row,
      full_name: userMap.get(row.student_id)?.full_name,
      institution_identifier: userMap.get(row.student_id)?.institution_identifier,
    }));
  }
}

export default Enrollment;