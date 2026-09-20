import { supabaseAdmin } from "../config/supabase.js";

/**
 * The maximum acceptable GPS accuracy in meters. If the lecturer's device
 * reports a higher accuracy value (i.e., a less precise reading), the
 * session start will be rejected.
 */
const MAX_ACCEPTABLE_ACCURACY_METERS = 250;

/** Offset in milliseconds used to shift UTC time to West Africa Time (WAT, UTC+1). */
const WAT_OFFSET_MS = 60 * 60 * 1000;

/**
 * Handles the lifecycle of a lecturer's live class attendance session:
 * starting a session (with venue/GPS verification), ending it, and
 * querying which sessions are currently active.
 */
class ClassSession {
  /**
   * Converts a "HH:mm:ss" (or "HH:mm") time string into total seconds.
   *
   * @param {string} timeStr - Time in "HH:mm:ss" or "HH:mm" format.
   * @returns {number} The equivalent number of seconds.
   */
  static timeToSeconds(timeStr) {
    const [h, m, s] = timeStr.split(":").map(Number);
    return h * 3600 + (m || 0) * 60 + (s || 0);
  }

  /**
   * Builds an ISO-like scheduled start timestamp string for a session,
   * fixed to the West Africa Time (+01:00) offset.
   *
   * @param {string} sessionDate - Session date in "YYYY-MM-DD" format.
   * @param {string} startHour - Scheduled start time in "HH:mm:ss" format.
   * @returns {string} A timestamp string with a +01:00 offset, e.g. "2026-09-16T10:00:00+01:00".
   */
  static buildScheduledStart(sessionDate, startHour) {
    return `${sessionDate}T${startHour}+01:00`;
  }

  /**
   * Adds a duration (given as a "HH:mm:ss" time string) to a timestamp.
   *
   * @param {string} timestampStr - A parseable timestamp string to start from.
   * @param {string} durationTimeStr - Duration to add, in "HH:mm:ss" format.
   * @returns {string} The resulting timestamp as an ISO string.
   */
  static addDuration(timestampStr, durationTimeStr) {
    const date = new Date(timestampStr);
    const durationSeconds = ClassSession.timeToSeconds(durationTimeStr);
    date.setUTCSeconds(date.getUTCSeconds() + durationSeconds);
    return date.toISOString();
  }

  /**
   * Returns the current date/time shifted to Nigeria's timezone (WAT, UTC+1).
   *
   * @remarks
   * Single source of truth for "what is it right now in Nigeria" — both the
   * calendar date and the day-of-week are derived from this ONE shifted
   * timestamp, so they can never disagree with each other.
   *
   * @returns {Date} The current time shifted by {@link WAT_OFFSET_MS}.
   */
  static getNigeriaNow() {
    return new Date(Date.now() + WAT_OFFSET_MS);
  }

  /**
   * Calculates the great-circle distance between two lat/lng points using
   * the haversine formula.
   *
   * @param {number} lat1 - Latitude of the first point, in degrees.
   * @param {number} lon1 - Longitude of the first point, in degrees.
   * @param {number} lat2 - Latitude of the second point, in degrees.
   * @param {number} lon2 - Longitude of the second point, in degrees.
   * @returns {number} The distance between the two points, in meters.
   */
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

  /**
   * Starts (or resumes) a lecturer's attendance session for a scheduled
   * class, verifying the schedule ownership, the day/date validity, GPS
   * accuracy, and proximity to the registered venue.
   *
   * @remarks
   * If a session row already exists for this schedule and date (in a
   * non-terminal state), it is reactivated in place rather than creating a
   * duplicate row. A session that isn't within the venue's allowed radius
   * is still started, but flagged via `venue_verified: false` and a
   * `warning` message for review, rather than rejected outright.
   *
   * @param {object} params - Session start parameters.
   * @param {string} params.class_schedule_id - ID of the class schedule to start a session for.
   * @param {number} params.latitude - Lecturer's current latitude.
   * @param {number} params.longitude - Lecturer's current longitude.
   * @param {number} [params.accuracy] - Reported GPS accuracy in meters, if available.
   * @param {string} lecturerId - ID of the lecturer starting the session.
   * @returns {Promise<object>} The created or reactivated session row, plus
   *   `distance_from_venue_meters` and `warning` (`null` if venue-verified).
   * @throws {Error} 400 if required fields are missing, the schedule has no
   *   venue, today isn't the scheduled day, today's date is outside the
   *   schedule's effective range, the scheduled start time hasn't arrived
   *   yet, or GPS accuracy is worse than {@link MAX_ACCEPTABLE_ACCURACY_METERS}.
   * @throws {Error} 403 if the lecturer isn't assigned to this course.
   * @throws {Error} 404 if the schedule doesn't exist.
   * @throws {Error} 409 if a session for today is already active or has already ended.
   * @throws {Error} 500 on a database read/write failure.
   */
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

    // A lecturer can't start a class before its scheduled start time —
    // both compared as seconds-of-day in Nigeria-local time, off the same
    // shifted `nigeriaNow` timestamp everything else here uses.
    const nowSecondsOfDay =
      nigeriaNow.getUTCHours() * 3600 + nigeriaNow.getUTCMinutes() * 60 + nigeriaNow.getUTCSeconds();
    const scheduledStartSeconds = ClassSession.timeToSeconds(schedule.start_hour);

    if (nowSecondsOfDay < scheduledStartSeconds) {
      const err = new Error("This class hasn't reached its scheduled start time yet");
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

  /**
   * Ends a lecturer's currently active attendance session.
   *
   * @param {string} session_id - ID of the session to end.
   * @param {string} lecturerId - ID of the lecturer requesting to end the session.
   * @returns {Promise<object>} The updated session row, with `status: "ENDED"`.
   * @throws {Error} 403 if the lecturer didn't start this session.
   * @throws {Error} 404 if the session doesn't exist.
   * @throws {Error} 409 if the session isn't currently active.
   * @throws {Error} 500 on a database read/write failure.
   */
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

  /**
   * Fetches all currently active class sessions for a given lecturer.
   *
   * @param {string} lecturerId - ID of the lecturer whose active sessions to fetch.
   * @returns {Promise<object[]>} Active session rows, each joined with its
   *   course's `course_code`/`course_name` and venue `name`/`latitude`/`longitude`.
   * @throws {Error} 500 on a database read failure.
   */
  /**
   * The logged-in lecturer's sessions, newest first — the history the
   * Courses page reads to know which occurrences already ran (so a class
   * that was started and ended early isn't offered for a second start).
   *
   * @param {string} lecturerId - auth user id of the logged-in lecturer.
   * @param {{ from?: string, to?: string, status?: "ACTIVE"|"ENDED", limit?: number }} [filters]
   *   from/to bound session_date (YYYY-MM-DD, inclusive).
   */
  static async getMySessions(lecturerId, { from, to, status, limit } = {}) {
    if (status && !["ACTIVE", "ENDED"].includes(status)) {
      const err = new Error("status must be ACTIVE or ENDED");
      err.statusCode = 400;
      throw err;
    }
    const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    if ((from && !isDate(from)) || (to && !isDate(to))) {
      const err = new Error("from and to must be dates in YYYY-MM-DD format");
      err.statusCode = 400;
      throw err;
    }

    const rowLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);

    let query = supabaseAdmin
      .from("class_sessions")
      .select("*, courses(course_code, course_name), venues(name, latitude, longitude)")
      .eq("lecturer_id", lecturerId)
      .order("scheduled_start_at", { ascending: false })
      .limit(rowLimit);

    if (status) query = query.eq("status", status);
    if (from) query = query.gte("session_date", from);
    if (to) query = query.lte("session_date", to);

    const { data, error } = await query;
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  static async getActiveSessions(lecturerId) {
    const { data, error } = await supabaseAdmin
      .from("class_sessions")
      .select("*, courses(course_code, course_name), venues(name, latitude, longitude)")
      .eq("lecturer_id", lecturerId)
      .eq("status", "ACTIVE");

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  /**
   * Fetches all currently active class sessions for courses matching a
   * student's department + level — the same basis
   * classScheduleService.js's getMyScheduleAsStudent and
   * enrollmentService.js's getEligibleCourses already use. There's no
   * GET /class-sessions/active equivalent for students otherwise, since
   * that endpoint is scoped to `lecturer_id` and a student isn't one.
   *
   * @param {string} studentUserId - auth user id of the logged-in student.
   * @returns {Promise<object[]>} Active session rows for the student's
   *   eligible courses, each joined with course code/name and venue
   *   name/latitude/longitude.
   * @throws {Error} 404 if the student record doesn't exist.
   * @throws {Error} 500 on a database read failure.
   */
  static async getActiveSessionsForStudent(studentUserId) {
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("department_id, current_level")
      .eq("user_id", studentUserId)
      .single();

    if (studentError || !student) {
      const err = new Error("Student record not found");
      err.statusCode = 404;
      throw err;
    }

    const { data: courses, error: coursesError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("department_id", student.department_id)
      .eq("level", Number(student.current_level));

    if (coursesError) {
      const err = new Error(coursesError.message);
      err.statusCode = 500;
      throw err;
    }

    if (!courses.length) return [];

    const courseIds = courses.map((c) => c.id);

    const { data, error } = await supabaseAdmin
      .from("class_sessions")
      .select("*, courses(course_code, course_name), venues(name, latitude, longitude)")
      .in("course_id", courseIds)
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