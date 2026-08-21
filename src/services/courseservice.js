import { supabaseAdmin } from "../config/supabase.js";

class Courses {
  static async createcourses({ course_code, course_name, level, department_id, credit_unit, lecturer_id }) {
   
    const code = course_code?.trim().toUpperCase();
    const cleanedName = course_name?.trim();

    
    if (!code || !cleanedName || !level || !department_id || !credit_unit || !lecturer_id) {
      const err = new Error("Please provide all required fields");
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
      })
      .select(); 

    if (error) {
      const err = new Error(error.message || "Failed to create course");
      err.statusCode = 400; 
      throw err;
    }

    return data[0]; 
  }


  static async getMyCourses(lecturer_id) {
    const { data, error } = await supabaseAdmin
    .from("courses")
    .select("id, course_code, course_name")
    .eq("lecturer_id", lecturer_id);

    if (error) {
      const err = new Error(error.message || "Failed to fetch courses");
      err.statusCode = 400;
      throw err;
    }
  return data;
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
