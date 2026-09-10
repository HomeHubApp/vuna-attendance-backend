import { supabaseAdmin } from "../config/supabase.js";

class Venue {
  static async createVenue(
    { name, latitude, longitude, radius_meters },
    createdBy,
  ) {
    if (!name || latitude === undefined || longitude === undefined) {
      const err = new Error("name, latitude, and longitude are required");
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from("venues")
      .insert({
        name,
        latitude,
        longitude,
        radius_meters: radius_meters ?? 50,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const err = new Error("A venue with this name already exists");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  static async getAllVenues({ activeOnly = true } = {}) {
    let query = supabaseAdmin
      .from("venues")
      .select("*")
      .order("name", { ascending: true });
    if (activeOnly) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }
    return data;
  }

  static async getVenueById(id, updates) {
    const allowedFields = [
      "name",
      "latitude",
      "longitude",
      "radius_meters",
      "is_active",
    ];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error("No valid fields to update");
      err.statusCode = 400;
      throw err;
      q;
    }

    const { data, error } = await supabaseAdmin
      .from("venues")
      .update(safeUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const err = new Error("A venue with this name already exists");
        err.statusCode = 409;
        throw err;
      }

      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    if (!data) {
      const err = new Error("Venue not found");
      err.statusCode = 404;
      throw err;
    }

    return data;
  }

  static async deactivateVenue(id) {
    const { data, error } = await supabaseAdmin
      .from("venues")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }
    if (!data) {
      const err = new Error("Venue not found");
      err.statusCode = 404;
      throw err;
    }

    return { message: "Venue deactivated successfully", venue: data };
  }
}
