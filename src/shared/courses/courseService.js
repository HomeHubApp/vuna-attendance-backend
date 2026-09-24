/**
 * @file Course CRUD against the `courses` table, plus a lecturer's own
 * course list (with each course's owning department name).
 *
 * @remarks
 * Lives in `shared/` because `admin/courses/courseController.js`
 * (create/update/delete, Admin-only), `shared/courses/courseController.js`
 * (list/get, open to any logged-in user) and `lecturer/courses/courseController.js`
 * (`getMyCourses`) all call into this one service.
 */
import { supabaseAdmin } from "../../config/supabase.js";

class Courses {
  static async createcourses({ course_code, course_name, level, department_id, credit_unit, lecturer_id, semester }) {

    const code = course_code?.trim().toUpperCase();
    const cleanedName = course_name?.trim();


    if (!code || !cleanedName || !level || !department_id || !credit_unit || !lecturer_id || !semester) {
      const err = new Error("Please provide all required fields");
      err.statusCode = 400;
      throw err;
    }

    // This is for validating semester is one of the two allowed values — 1 = first semester, 2 = second semester
    if (![1, 2].includes(Number(semester))) {
      const err = new Error("semester must be 1 (first semester) or 2 (second semester)");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("courses")
      .insert({
        course_code: code,
        course_name: cleanedName,
        level,
        department_id,
        credit_unit,
        lecturer_id,
        semester: Number(semester),
      })
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to create course");
      err.statusCode = 400; 
      throw err;
    }

    return data[0]; 
  }


  /**
   * The courses a lecturer teaches, each with its owning department's name
   * as `departments: { name } | null` (null when the course has no
   * department or it was deleted).
   *
   * The names come from a second small query rather than a PostgREST
   * `departments(name)` embed, so this doesn't depend on courses.department_id
   * being declared as a foreign key — the response shape is what an embed
   * would return, so it can be swapped for one later without touching callers.
   *
   * @param {string} lecturer_id - auth user id of the lecturer.
   */
  static async getMyCourses(lecturer_id) {
    const { data, error } = await supabaseAdmin
    .from("courses")
    .select("id, course_code, course_name, level, credit_unit, semester, department_id")
    .eq("lecturer_id", lecturer_id);

    if (error) {
      const err = new Error(error.message || "Failed to fetch courses");
      err.statusCode = 400;
      throw err;
    }

    const departmentIds = [...new Set(data.map((course) => course.department_id).filter(Boolean))];
    const departmentNames = new Map();
    if (departmentIds.length > 0) {
      const { data: departments, error: departmentsError } = await supabaseAdmin
        .from("departments")
        .select("id, name")
        .in("id", departmentIds);

      if (departmentsError) {
        const err = new Error(departmentsError.message || "Failed to fetch departments");
        err.statusCode = 400;
        throw err;
      }
      for (const department of departments) departmentNames.set(department.id, department.name);
    }

    return data.map(({ department_id, ...course }) => ({
      ...course,
      departments: departmentNames.has(department_id) ? { name: departmentNames.get(department_id) } : null,
    }));
}
static async getAllCourses() {
 
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select("*");


  if (error) {
    const err = new Error(error.message || "Failed to fetch courses");
    err.statusCode = 400;
    throw err;
  }

  return data; 
}



  static async deleteCourse(course_id) {
    if (!course_id) {
      const err = new Error("Course ID is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("courses")
      .delete()
      .eq("id", course_id)
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to delete course");
      err.statusCode = 400;
      throw err;
    }

   
    if (!data || data.length === 0) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    return { message: "Course successfully deleted", deletedCourse: data[0] };
  }
  static async getCourseById(course_id) {
    if (!course_id) {
      const err = new Error("Course ID is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (error) {
      const err = new Error(error.message || "Course not found");
      err.statusCode = 404; 
      throw err;
    }

    return data;
  }


  static async updateCourse(course_id, updates) {
    if (!course_id) {
      const err = new Error("Course ID is required");
      err.statusCode = 400;
      throw err;
    }

    // This is for validating semester when it's included in a partial update — same 1/2 rule as create
    if (updates.semester !== undefined) {
      if (![1, 2].includes(Number(updates.semester))) {
        const err = new Error("semester must be 1 (first semester) or 2 (second semester)");
        err.statusCode = 400;
        throw err;
      }
      updates.semester = Number(updates.semester);
    }

    const { data, error } = await supabaseAdmin
      .from("courses")
      .update(updates)
      .eq("id", course_id)
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to update course");
      err.statusCode = 400;
      throw err;
    }

    if (!data || data.length === 0) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    return data[0];
  }
}
export default Courses;
