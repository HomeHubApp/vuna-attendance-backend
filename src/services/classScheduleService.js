import { supabaseAdmin } from "../config/supabase.js";

const DAY_MAP = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };


class ClassSchedule {
  static timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + (minutes || 0);
  }

    static async checkVenueConflict({ venue_id, day_index, start_hour, duration, effective_start_date, effective_end_date, excludeScheduleId }) {
    const { data: existingSchedules, error } = await supabaseAdmin
      .from("class_schedule")
      .select("id, start_hour, duration, effective_start_date, effective_end_date")
      .eq("venue_id", venue_id)
      .eq("day_index", day_index)
      .eq("is_active", true);

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    const newStart = ClassSchedule.timeToMinutes(start_hour);
    const newEnd = newStart + ClassSchedule.timeToMinutes(duration);

    const conflict = existingSchedules.find((s) => {
      if (excludeScheduleId && s.id === excludeScheduleId) return false;

      const existingStart = ClassSchedule.timeToMinutes(s.start_hour);
      const existingEnd = existingStart + ClassSchedule.timeToMinutes(s.duration);

      const timeOverlaps = newStart < existingEnd && existingStart < newEnd;
      const datesOverlap = effective_start_date <= s.effective_end_date && s.effective_start_date <= effective_end_date;

      return timeOverlaps && datesOverlap;
    });

    if (conflict) {
      const err = new Error("This venue is already booked for an overlapping time slot");
      err.statusCode = 409;
      throw err;
    }
  }

  static async createSchedule(
    { course_id, schedule_type, venue_id, start_hour, duration, days, effective_start_date, effective_end_date },
    requestingLecturerId,
  ) {
    if (!course_id || !venue_id || !days?.length) {
      const err = new Error("course_id, venue_id, and at least one day are required");
      err.statusCode = 400;
      throw err;
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, lecturer_id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    if (course.lecturer_id !== requestingLecturerId) {
      const err = new Error("You are not assigned to this course");
      err.statusCode = 403;
      throw err;
    }

    const rows = [];
    for (const day of days) {
      const day_index = DAY_MAP[day];
      if (day_index === undefined) {
        const err = new Error(`Invalid day: ${day}`);
        err.statusCode = 400;
        throw err;
      }

      await ClassSchedule.checkVenueConflict({
        venue_id,
        day_index,
        start_hour,
        duration,
        effective_start_date,
        effective_end_date,
      });

      rows.push({ course_id, schedule_type, venue_id, start_hour, duration, day_index, effective_start_date, effective_end_date, is_active: true });
    }

    const { data, error } = await supabaseAdmin.from("class_schedule").insert(rows).select();

    if (error) {
      const err = new Error(error.message || "Failed to create schedule");
      err.statusCode = 400;
      throw err;
    }

    return data;
  }

  static async getMySchedules(lecturerId) {
    const { data: courses, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, course_code, course_name")
      .eq("lecturer_id", lecturerId);

    if (courseError) {
      const err = new Error(courseError.message);
      err.statusCode = 500;
      throw err;
    }

    if (!courses.length) return [];

    const courseIds = courses.map((c) => c.id);
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("class_schedule")
      .select("*, venues(name, latitude, longitude)")
      .in("course_id", courseIds)
      .eq("is_active", true);

    if (scheduleError) {
      const err = new Error(scheduleError.message);
      err.statusCode = 500;
      throw err;
    }

    return schedule.map((row) => ({
      ...row,
      course_code: courseMap.get(row.course_id)?.course_code,
      course_name: courseMap.get(row.course_id)?.course_name,
    }));
  }

  static async updateSchedule(class_schedule_id, updates, requestingLecturerId) {
    if (!class_schedule_id) {
      const err = new Error("class_schedule_id is required");
      err.statusCode = 400;
      throw err;
    }

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("class_schedule")
      .select("id, course_id, venue_id, day_index, start_hour, duration, effective_start_date, effective_end_date, courses(lecturer_id)")
      .eq("id", class_schedule_id)
      .single();

    if (scheduleError || !schedule) {
      const err = new Error("Schedule not found");
      err.statusCode = 404;
      throw err;
    }

    if (schedule.courses.lecturer_id !== requestingLecturerId) {
      const err = new Error("You are not assigned to this course");
      err.statusCode = 403;
      throw err;
    }

    // course_id is deliberately excluded — locked, never editable
    const allowedFields = ["schedule_type", "venue_id", "start_hour", "duration", "day_index", "effective_start_date", "effective_end_date"];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (updates.day_index !== undefined && typeof updates.day_index === "string" && DAY_MAP[updates.day_index] !== undefined) {
      safeUpdates.day_index = DAY_MAP[updates.day_index];
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error("No valid fields provided to update");
      err.statusCode = 400;
      throw err;
    }

    // Re-check venue conflict if anything conflict-relevant changed
    const conflictRelevantFields = ["venue_id", "day_index", "start_hour", "duration", "effective_start_date", "effective_end_date"];
    const conflictFieldChanged = conflictRelevantFields.some((f) => safeUpdates[f] !== undefined);

    if (conflictFieldChanged) {
      await ClassSchedule.checkVenueConflict({
        venue_id: safeUpdates.venue_id ?? schedule.venue_id,
        day_index: safeUpdates.day_index ?? schedule.day_index,
        start_hour: safeUpdates.start_hour ?? schedule.start_hour,
        duration: safeUpdates.duration ?? schedule.duration,
        effective_start_date: safeUpdates.effective_start_date ?? schedule.effective_start_date,
        effective_end_date: safeUpdates.effective_end_date ?? schedule.effective_end_date,
        excludeScheduleId: class_schedule_id,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("class_schedule")
      .update(safeUpdates)
      .eq("id", class_schedule_id)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  }

  static async deleteSchedule(class_schedule_id, requestingLecturerId) {
    if (!class_schedule_id) {
      const err = new Error("class_schedule_id is required");
      err.statusCode = 400;
      throw err;
    }

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("class_schedule")
      .select("id, course_id, courses(lecturer_id)")
      .eq("id", class_schedule_id)
      .single();

    if (scheduleError || !schedule) {
      const err = new Error("Schedule not found");
      err.statusCode = 404;
      throw err;
    }

    if (schedule.courses.lecturer_id !== requestingLecturerId) {
      const err = new Error("You are not assigned to this course");
      err.statusCode = 403;
      throw err;
    }

    const { error } = await supabaseAdmin
      .from("class_schedule")
      .update({ is_active: false })
      .eq("id", class_schedule_id);

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return { message: "Schedule deleted successfully" };
  }
}

export default ClassSchedule;