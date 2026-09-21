import { supabaseAdmin } from "../config/supabase.js";

class Faculty {
  // CREATE
  static async createFaculty({ name }) {
    const cleanName = name?.trim();


    if (!cleanName) {
      const err = new Error("Faculty name is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("faculties")
      .insert({ name: cleanName })
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to create faculty");
      err.statusCode = 400;
      throw err;
    }

    return data[0];
  }

  // READ (All)
  static async getFaculty() {
    const { data, error } = await supabaseAdmin
      .from("faculties")
      .select("*");

    if (error) {
      const err = new Error(error.message || "Failed to fetch faculties");
      err.statusCode = 400;
      throw err;
    }

    return data;
  }

  // READ (Single by ID)
  static async getFacultyById(id) {
    const { data, error } = await supabaseAdmin
      .from("faculties")
      .select("*")
      .eq("id", id)
      .single(); // Tells Supabase to expect exactly one row

    if (error) {
      const err = new Error(error.message || "Faculty not found");
      err.statusCode = 404;
      throw err;
    }

    return data;
  }

  // UPDATE
  static async updateFaculty(id, updates) {
    if (!id) {
      const err = new Error("Faculty ID is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("faculties")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to update faculty");
      err.statusCode = 400;
      throw err;
    }

    if (!data || data.length === 0) {
      const err = new Error("Faculty not found");
      err.statusCode = 404;
      throw err;
    }

    return data[0];
  }

  // DELETE
  static async deleteFaculty(id) {
    if (!id) {
      const err = new Error("Faculty ID is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("faculties")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to delete faculty");
      err.statusCode = 400;
      throw err;
    }

    if (!data || data.length === 0) {
      const err = new Error("Faculty not found");
      err.statusCode = 404;
      throw err;
    }

    return { message: "Faculty successfully deleted", deletedFaculty: data[0] };
  }
}

export default Faculty;