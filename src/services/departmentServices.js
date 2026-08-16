import { supabaseAdmin } from "../config/supabase.js";

class Department {
  // CREATE
  static async createDepartment({ name, abbreviation }) {
    const cleanName = name?.trim();
    const cleanCode = abbreviation?.trim().toUpperCase();

    if (!cleanName || !cleanCode) {
      const err = new Error("Department name and code are required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .insert({ name: cleanName, abbreviation: cleanCode })
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to create department");
      err.statusCode = 400;
      throw err;
    }

    return data[0];
  }

  // READ (All)
  static async getAllDepartments() {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("*");

    if (error) {
      const err = new Error(error.message || "Failed to fetch departments");
      err.statusCode = 400;
      throw err;
    }

    return data;
  }

  // READ (Single by ID)
  static async getDepartmentById(id) {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("*")
      .eq("id", id)
      .single(); // Tells Supabase to expect exactly one row

    if (error) {
      const err = new Error(error.message || "Department not found");
      err.statusCode = 404;
      throw err;
    }

    return data;
  }

  // UPDATE
  static async updateDepartment(id, updates) {
    if (!id) {
      const err = new Error("Department ID is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to update department");
      err.statusCode = 400;
      throw err;
    }

    if (!data || data.length === 0) {
      const err = new Error("Department not found");
      err.statusCode = 404;
      throw err;
    }

    return data[0];
  }

  // DELETE
  static async deleteDepartment(id) {
    if (!id) {
      const err = new Error("Department ID is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      const err = new Error(error.message || "Failed to delete department");
      err.statusCode = 400;
      throw err;
    }

    if (!data || data.length === 0) {
      const err = new Error("Department not found");
      err.statusCode = 404;
      throw err;
    }

    return { message: "Department successfully deleted", deletedDepartment: data[0] };
  }
}

export default Department;