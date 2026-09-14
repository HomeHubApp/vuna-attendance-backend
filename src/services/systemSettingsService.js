import { supabaseAdmin } from "../config/supabase.js";

// The settings table is a singleton — exactly one row, always at id = 1 (see system_settings_schema.sql)
const SETTINGS_ROW_ID = 1;

class SystemSettings {
  // This is for fetching the one institution-wide settings row
  static async getSettings() {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .eq("id", SETTINGS_ROW_ID)
      .single();

    if (error) {
      const err = new Error(error.message || "Failed to fetch system settings");
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  // This is for updating the institution-wide settings row — only the fields provided are changed
  static async updateSettings(updates, updatedBy) {
    const allowedFields = [
      "academic_year",
      "semester",
      "min_attendance_percentage",
      "require_location_verification",
      "require_wifi_verification",
    ];

    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error("No valid fields provided to update");
      err.statusCode = 400;
      throw err;
    }

    // This is for validating academic_year is non-empty text, when provided
    if (safeUpdates.academic_year !== undefined) {
      const trimmed = String(safeUpdates.academic_year).trim();
      if (!trimmed) {
        const err = new Error("academic_year cannot be empty");
        err.statusCode = 400;
        throw err;
      }
      safeUpdates.academic_year = trimmed;
    }

    // This is for validating semester is one of the two allowed values, when provided
    if (safeUpdates.semester !== undefined) {
      if (![1, 2].includes(Number(safeUpdates.semester))) {
        const err = new Error("semester must be 1 (first semester) or 2 (second semester)");
        err.statusCode = 400;
        throw err;
      }
      safeUpdates.semester = Number(safeUpdates.semester);
    }

    // This is for validating the attendance threshold is a sane percentage, when provided
    if (safeUpdates.min_attendance_percentage !== undefined) {
      const percentage = Number(safeUpdates.min_attendance_percentage);
      if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
        const err = new Error("min_attendance_percentage must be a number between 0 and 100");
        err.statusCode = 400;
        throw err;
      }
      safeUpdates.min_attendance_percentage = percentage;
    }

    // This is for recording who last changed the settings and when
    safeUpdates.updated_by = updatedBy;
    safeUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .update(safeUpdates)
      .eq("id", SETTINGS_ROW_ID)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message || "Failed to update system settings");
      err.statusCode = 500;
      throw err;
    }

    return data;
  }
}

export default SystemSettings;
