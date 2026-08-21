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

  static async getMySchedules(lecturer_id) {
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from("courses")
      .select("id, course_code, course_name")
      .eq("lecturer_id", lecturer_id);

    if (coursesError) {
      const err = new Error(coursesError.message || "Failed to fetch courses");
      err.statusCode = 500;
      throw err;
    }

    if (!courses.length) {
      return [];
    }

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
}

export default ClassSchedule;
