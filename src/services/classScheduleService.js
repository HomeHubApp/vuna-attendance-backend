import { supabaseAdmin } from "../config/supabase.js";

const DAY_MAP = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

class ClassSchedule {
  static async createSchedule(
    {
      course_id,
      schedule_type,
      location,
      start_hour,
      duration,
      days,
      effective_start_date,
      effective_end_date,
    },
    requestingLecturerId,
  ) {
    if (!course_id || !days?.length) {
      const err = new Error("course_id and at least one day are required");
      err.statusCode = 400;
      throw err;
    }

    // Confirm this lecturer actually owns the course before letting
    // them schedule it — prevents scheduling against someone else's course.
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

      return {
        course_id,
        schedule_type,
        location,
        start_hour,
        duration,
        day_index,
        effective_start_date,
        effective_end_date,
        is_active: true,
      };
    });

    const { data, error } = await supabaseAdmin
      .from("class_schedule")
      .insert(rows)
      .select();

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

    const scheduleIds = schedule.map((s) => s.id);

    const { data: exceptions } = await supabaseAdmin
        .from("class_schedule_exceptions")
        .select("*")
        .in("class_schedule_id", scheduleIds);

    // group exceptions by which schedule row they belong to
    const exceptionMap = new Map();
    (exceptions || []).forEach((ex) => {
        if (!exceptionMap.has(ex.class_schedule_id)) {
            exceptionMap.set(ex.class_schedule_id, []);
        }
        exceptionMap.get(ex.class_schedule_id).push(ex);
    });

    return schedule.map((row) => ({
        ...row,
        course_code: courseMap.get(row.course_id)?.course_code,
        course_name: courseMap.get(row.course_id)?.course_name,
        exceptions: exceptionMap.get(row.id) || [],
    }));
}
static async rescheduleSchedule({
    class_schedule_id,
    original_date,
    new_date,
    new_start_hour,
    new_location,
}, requestingLecturerId) {
    if (!class_schedule_id || !original_date || !new_date) {
        const err = new Error("class_schedule_id, original_date, and new_date are required");
        err.statusCode = 400;
        throw err;
    }

    // confirm this schedule slot belongs to a course this lecturer actually teaches
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

    const { data, error } = await supabaseAdmin
        .from("class_schedule_exceptions")
        .insert({
            class_schedule_id,
            original_date,
            exception_type: "RESCHEDULED",
            new_date,
            new_start_hour: new_start_hour || null,
            new_location: new_location || null,
            created_by: requestingLecturerId,
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            // unique constraint violation — an exception already exists for this date
            const err = new Error("An exception already exists for this occurrence. Cancel or update it first.");
            err.statusCode = 409;
            throw err;
        }
        const err = new Error(error.message);
        err.statusCode = 500;
        throw err;
    }

    return data;
}

static async cancelSchedule({ class_schedule_id, original_date }, requestingLecturerId) {
    if (!class_schedule_id || !original_date) {
        const err = new Error("class_schedule_id and original_date are required");
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

    const { data, error } = await supabaseAdmin
        .from("class_schedule_exceptions")
        .insert({
            class_schedule_id,
            original_date,
            exception_type: "CANCELLED",
            created_by: requestingLecturerId,
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            const err = new Error("An exception already exists for this occurrence. Cancel or update it first.");
            err.statusCode = 409;
            throw err;
        }
        const err = new Error(error.message);
        err.statusCode = 500;
        throw err;
    }

    return data;
}
}

export default ClassSchedule;