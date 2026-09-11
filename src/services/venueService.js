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

    const { data: venues, error } = await query;
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    if (venues.length === 0) return venues;

    // Attach the classes currently booked into each venue — same
    // multi-step fetch + Map-join pattern classScheduleService.js's
    // getMySchedules uses (course_id -> courses, here venue_id ->
    // class_schedule -> courses -> users, so we know the lecturer's name).
    const venueIds = venues.map((v) => v.id);

    const { data: schedules, error: scheduleError } = await supabaseAdmin
      .from("class_schedule")
      .select(
        "venue_id, schedule_type, day_index, start_hour, duration, courses(course_code, course_name, lecturer_id)",
      )
      .in("venue_id", venueIds)
      .eq("is_active", true);

    if (scheduleError) {
      const err = new Error(scheduleError.message);
      err.statusCode = 500;
      throw err;
    }

    const lecturerIds = [
      ...new Set(schedules.map((s) => s.courses?.lecturer_id).filter(Boolean)),
    ];

    let lecturerNameById = new Map();
    if (lecturerIds.length > 0) {
      const { data: lecturers, error: lecturerError } = await supabaseAdmin
        .from("users")
        .select("id, full_name")
        .in("id", lecturerIds);

      if (lecturerError) {
        const err = new Error(lecturerError.message);
        err.statusCode = 500;
        throw err;
      }
      lecturerNameById = new Map(lecturers.map((l) => [l.id, l.full_name]));
    }

    const bookingsByVenueId = new Map();
    for (const s of schedules) {
      const booking = {
        courseCode: s.courses?.course_code ?? "",
        courseTitle: s.courses?.course_name ?? "",
        lecturerName: lecturerNameById.get(s.courses?.lecturer_id) ?? "Unassigned",
        scheduleType: s.schedule_type,
        dayIndex: s.day_index,
        startHour: s.start_hour,
        duration: s.duration,
      };
      if (!bookingsByVenueId.has(s.venue_id)) bookingsByVenueId.set(s.venue_id, []);
      bookingsByVenueId.get(s.venue_id).push(booking);
    }

    return venues.map((v) => ({ ...v, bookings: bookingsByVenueId.get(v.id) ?? [] }));
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

export default Venue;
