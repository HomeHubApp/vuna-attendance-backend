import { supabaseAdmin } from "../config/supabase.js";

const MAX_ACCEPTABLE_ACCURACY_METERS = 100;
const WAT_OFFSET_MS = 60 * 60 * 1000; 

class ClassSession {
  static timeToSeconds(timeStr) {
    const [h, m, s] = timeStr.split(":").map(Number);
    return h * 3600 + (m || 0) * 60 + (s || 0);
  }

  static buildScheduledStart(sessionDate, startHour) {
    return `${sessionDate}T${startHour}+01:00`;
  }

  static addDuration(timestampStr, durationTimeStr) {
    const date = new Date(timestampStr);
    const durationSeconds = ClassSession.timeToSeconds(durationTimeStr);
    date.setUTCSeconds(date.getUTCSeconds() + durationSeconds);
    return date.toISOString();
  }

  // Single source of truth for "what is it right now in Nigeria" — both the
  // calendar date and the day-of-week are derived from this ONE shifted
  // timestamp, so they can never disagree with each other.
  static getNigeriaNow() {
    return new Date(Date.now() + WAT_OFFSET_MS);
  }

  static haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static async startSession({ class_schedule_id, latitude, longitude, accuracy }, lecturerId) {
    if (!class_schedule_id || latitude === undefined || longitude === undefined) {
      const err = new Error("class_schedule_id, latitude, and longitude are required");
      err.statusCode = 400;
      throw err;
    }

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("class_schedule")
      .select("id, course_id, venue_id, start_hour, duration, day_index, effective_start_date, effective_end_date, courses(lecturer_id), venues(latitude, longitude, radius_meters)")
      .eq("id", class_schedule_id)
      .single();

    if (scheduleError || !schedule) {
      const err = new Error("Schedule not found");
      err.statusCode = 404;
      throw err;
    }

    if (schedule.courses.lecturer_id !== lecturerId) {
      const err = new Error("You are not assigned to this course");
      err.statusCode = 403;
      throw err;
    }

    if (!schedule.venue_id || !schedule.venues) {
      const err = new Error("This schedule has no venue assigned yet");
      err.statusCode = 400;
      throw err;
    }

    // Nigeria-local date and day-of-week, both from the same shifted timestamp
    const nigeriaNow = ClassSession.getNigeriaNow();
    const session_date = nigeriaNow.toISOString().slice(0, 10);
    const nigeriaDayIndex = nigeriaNow.getUTCDay(); 

    if (nigeriaDayIndex !== schedule.day_index) {
      const err = new Error("Today is not the scheduled day for this class");
      err.statusCode = 400;
      throw err;
    }

    if (session_date < schedule.effective_start_date || session_date > schedule.effective_end_date) {
      const err = new Error("This schedule is not active for today's date");
      err.statusCode = 400;
      throw err;
    }

    if (accuracy !== undefined && accuracy !== null && accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      const err = new Error(`GPS accuracy too low (${accuracy}m). Move to an open area and try again.`);
      err.statusCode = 400;
      throw err;
    }

    const distance = ClassSession.haversineDistanceMeters(latitude, longitude, schedule.venues.latitude, schedule.venues.longitude);
    const venue_verified = distance <= schedule.venues.radius_meters;

    const warning = venue_verified
      ? null
      : `Your location is ${Math.round(distance)}m from the registered venue (allowed: ${schedule.venues.radius_meters}m). Session started, but this has been flagged for review.`;

    const scheduled_start_at = ClassSession.buildScheduledStart(session_date, schedule.start_hour);
    const scheduled_end_at = ClassSession.addDuration(scheduled_start_at, schedule.duration);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("class_sessions")
      .select("*")
      .eq("class_schedule_id", class_schedule_id)
      .eq("session_date", session_date)
      .maybeSingle();

    if (existingError) {
      const err = new Error(existingError.message);
      err.statusCode = 500;
      throw err;
    }

    if (existing) {
      if (existing.status === "ACTIVE") {
        const err = new Error("This session is already active");
        err.statusCode = 409;
        throw err;
      }
      if (existing.status === "ENDED") {
        const err = new Error("This session has already ended for today");
        err.statusCode = 409;
        throw err;
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("class_sessions")
        .update({
          status: "ACTIVE",
          actual_start_at: new Date().toISOString(),
          lecturer_start_lat: latitude,
          lecturer_start_lng: longitude,
          lecturer_start_accuracy_meters: accuracy ?? null,
          venue_verified,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
      }
      return { ...updated, distance_from_venue_meters: Math.round(distance), warning };
    }

    const { data: created, error: createError } = await supabaseAdmin
      .from("class_sessions")
      .insert({
        class_schedule_id,
        course_id: schedule.course_id,
        lecturer_id: lecturerId,
        venue_id: schedule.venue_id,
        session_date,
        scheduled_start_at,
        scheduled_end_at,
        actual_start_at: new Date().toISOString(),
        status: "ACTIVE",
        lecturer_start_lat: latitude,
        lecturer_start_lng: longitude,
        lecturer_start_accuracy_meters: accuracy ?? null,
        venue_verified,
      })
      .select()
      .single();

    if (createError) {
      const err = new Error(createError.message);
      err.statusCode = 500;
      throw err;
    }

    return { ...created, distance_from_venue_meters: Math.round(distance), warning };
  }

  static async endSession(session_id, lecturerId) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("class_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }

    if (session.lecturer_id !== lecturerId) {
      const err = new Error("You did not start this session");
      err.statusCode = 403;
      throw err;
    }

    if (session.status !== "ACTIVE") {
      const err = new Error("This session is not currently active");
      err.statusCode = 409;
      throw err;
    }

    const { data: ended, error } = await supabaseAdmin
      .from("class_sessions")
      .update({ status: "ENDED", actual_end_at: new Date().toISOString() })
      .eq("id", session_id)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return ended;
  }

  static async getActiveSessions(lecturerId) {
    const { data, error } = await supabaseAdmin
      .from("class_sessions")
      .select("*, courses(course_code, course_name), venues(name)")
      .eq("lecturer_id", lecturerId)
      .eq("status", "ACTIVE");

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  }
}

export default ClassSession;