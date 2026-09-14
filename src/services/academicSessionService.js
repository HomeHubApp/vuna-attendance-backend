import { supabaseAdmin } from "../config/supabase.js";

class AcademicSession {
  // This is for creating a new academic session (Admin only, enforced at the route level)
  static async createAcademicSession({ name, start_date, end_date }, createdBy) {
    const cleanedName = name?.trim();
    if (!cleanedName) {
      const err = new Error("name is required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("academic_sessions")
      .insert({
        name: cleanedName,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const err = new Error("An academic session with this name already exists");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(error.message || "Failed to create academic session");
      err.statusCode = 400;
      throw err;
    }

    return data;
  }

  // This is for listing every academic session, most recent first
  static async getAllAcademicSessions() {
    const { data, error } = await supabaseAdmin
      .from("academic_sessions")
      .select("*")
      .order("start_date", { ascending: false, nullsFirst: false });

    if (error) {
      const err = new Error(error.message || "Failed to fetch academic sessions");
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  // This is for editing an academic session — only the fields provided are
  // changed. There is deliberately no deleteAcademicSession: once created,
  // a session stays part of the institution's permanent history.
  static async updateAcademicSession(id, updates) {
    if (!id) {
      const err = new Error("Academic session ID is required");
      err.statusCode = 400;
      throw err;
    }

    const allowedFields = ["name", "start_date", "end_date"];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (safeUpdates.name !== undefined) {
      const trimmed = String(safeUpdates.name).trim();
      if (!trimmed) {
        const err = new Error("name cannot be empty");
        err.statusCode = 400;
        throw err;
      }
      safeUpdates.name = trimmed;
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error("No valid fields provided to update");
      err.statusCode = 400;
      throw err;
    }
    safeUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("academic_sessions")
      .update(safeUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const err = new Error("An academic session with this name already exists");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(error.message || "Failed to update academic session");
      err.statusCode = 400;
      throw err;
    }

    if (!data) {
      const err = new Error("Academic session not found");
      err.statusCode = 404;
      throw err;
    }

    return data;
  }
}

export default AcademicSession;
