import { supabaseAdmin } from "../config/supabase.js";

const DAY_MAP = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

class ClassSchedule {
  static async createSchedule(
    { course_id, schedule_type, location, start_hour, duration, days, effective_start_date, effective_end_date },
    requestingLecturerId,
  ) {
    if (!course_id || !days?.length) {
      const err = new Error("course_id and at least one day are required");
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

    const rows = days.map((day) => {
      const day_index = DAY_MAP[day];
      if (day_index === undefined) {
        const err = new Error(`Invalid day: ${day}`);
        err.statusCode = 400;
        throw err;
      }
      return { course_id, schedule_type, location, start_hour, duration, day_index, effective_start_date, effective_end_date, is_active: true };
    });

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
      .select("*")
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

    const allowedFields = ["schedule_type", "location", "start_hour", "duration", "day_index", "effective_start_date", "effective_end_date"];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (updates.day_index !== undefined && DAY_MAP[updates.day_index] === undefined && !Object.values(DAY_MAP).includes(updates.day_index)) {
      if (typeof updates.day_index === "string" && DAY_MAP[updates.day_index] !== undefined) {
        safeUpdates.day_index = DAY_MAP[updates.day_index];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error("No valid fields provided to update");
      err.statusCode = 400;
      throw err;
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