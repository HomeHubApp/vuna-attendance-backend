import { supabaseAdmin } from "../config/supabase.js";
import {
  notifyScheduleCreated,
  notifyScheduleRescheduled,
  notifyScheduleDeleted,
} from "./classScheduleNotifications.js";

const DAY_MAP = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

// Shortest class the API will accept — guards against junk rows like a
// 2-second duration that slipped in before duration was validated.
const MIN_DURATION_MINUTES = 15;


class ClassSchedule {
  static timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + (minutes || 0);
  }

  static formatMinutesAsClock(totalMinutes) {
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const minutes = String(Math.round(totalMinutes % 60)).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  // Accepts every shape a duration reaches this service in: the
  // "HH:MM[:SS]" interval Postgres returns for stored rows, and the
  // dropdown label the frontend sends on create/edit ("2 hours",
  // "1.5 hours"). The old venue check only understood the first shape, so
  // a label like "2 hours" parsed to NaN and every overlap comparison
  // against it silently came out false — i.e. conflicts were never caught
  // for newly created schedules. Returns total minutes, or null if the
  // value isn't a recognisable duration.
  static parseDurationToMinutes(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim().toLowerCase();

    let match = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (match) return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60;

    match = text.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)$/);
    if (match) return Number(match[1]) * 60;

    match = text.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)$/);
    if (match) return Number(match[1]);

    match = text.match(/^\d+(?:\.\d+)?$/);
    if (match) return Number(text) * 60;

    return null;
  }

  // Canonical "HH:MM:00" form stored in the interval column, regardless of
  // which input shape the duration arrived in.
  static minutesToInterval(totalMinutes) {
    const rounded = Math.round(totalMinutes);
    const hours = String(Math.floor(rounded / 60)).padStart(2, "0");
    const minutes = String(rounded % 60).padStart(2, "0");
    return `${hours}:${minutes}:00`;
  }

  // Validates and normalises the start_hour + duration pair every
  // schedule write needs, returning the numbers the conflict checks use.
  static resolveTimeSlot(start_hour, duration) {
    if (!start_hour || duration === undefined || duration === null || duration === "") {
      const err = new Error("start_hour and duration are required");
      err.statusCode = 400;
      throw err;
    }

    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(start_hour))) {
      const err = new Error("start_hour must be in HH:MM format");
      err.statusCode = 400;
      throw err;
    }

    const durationMinutes = ClassSchedule.parseDurationToMinutes(duration);
    if (durationMinutes === null) {
      const err = new Error("duration isn't a recognisable length of time");
      err.statusCode = 400;
      throw err;
    }

    if (durationMinutes < MIN_DURATION_MINUTES) {
      const err = new Error(`A class must last at least ${MIN_DURATION_MINUTES} minutes`);
      err.statusCode = 400;
      throw err;
    }

    return {
      startMinutes: ClassSchedule.timeToMinutes(start_hour),
      durationMinutes,
      durationInterval: ClassSchedule.minutesToInterval(durationMinutes),
    };
  }

  // Two date ranges overlap unless one ends before the other starts. A
  // missing bound is treated as open-ended (the columns are nullable).
  static datesOverlap(aStart, aEnd, bStart, bEnd) {
    const startsBeforeOtherEnds = !aStart || !bEnd || aStart <= bEnd;
    const otherStartsBeforeEnd = !bStart || !aEnd || bStart <= aEnd;
    return startsBeforeOtherEnds && otherStartsBeforeEnd;
  }

  // Today's calendar date in Nigeria (WAT, UTC+1), as YYYY-MM-DD —
  // classSessionService.js derives "today" the same way.
  static getTodayInNigeria() {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  static validateFixedDate(lecture_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lecture_date)) || Number.isNaN(Date.parse(`${lecture_date}T00:00:00Z`))) {
      const err = new Error("lecture_date must be a valid date in YYYY-MM-DD format");
      err.statusCode = 400;
      throw err;
    }

    if (lecture_date < ClassSchedule.getTodayInNigeria()) {
      const err = new Error("A Fixed Class can't be scheduled in the past");
      err.statusCode = 400;
      throw err;
    }
  }

  static dayIndexOfDate(isoDate) {
    return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  }

  // The one place every scheduling rule lives, called by create, edit and
  // Fixed Class creation alike so they can't drift apart:
  //   1. A course can't overlap itself — any type, recurring or fixed.
  //   2. A venue can't host two classes at once — any course.
  //   3. A course gets one RECURRING lecture per day (extra lectures go in
  //      as Fixed Classes; practicals, tutorials and seminars are free to
  //      share a day with a lecture so long as they don't overlap in time).
  // Rows are compared on the same weekday with overlapping effective date
  // ranges, which for a Fixed Class is just its single date. Back-to-back
  // classes (one ends exactly when the next starts) don't overlap.
  static async assertSlotAvailable({
    course_id,
    venue_id,
    day_index,
    startMinutes,
    durationMinutes,
    effective_start_date,
    effective_end_date,
    schedule_type,
    isFixed,
    excludeScheduleId,
  }) {
    const columns =
      "id, course_id, venue_id, schedule_type, start_hour, duration, effective_start_date, effective_end_date, lecture_date, courses(course_code)";

    const [courseRows, venueRows] = await Promise.all([
      supabaseAdmin.from("class_schedule").select(columns).eq("course_id", course_id).eq("day_index", day_index).eq("is_active", true),
      supabaseAdmin.from("class_schedule").select(columns).eq("venue_id", venue_id).eq("day_index", day_index).eq("is_active", true),
    ]);

    for (const result of [courseRows, venueRows]) {
      if (result.error) {
        const err = new Error(result.error.message);
        err.statusCode = 500;
        throw err;
      }
    }

    const newEnd = startMinutes + durationMinutes;
    const notSelf = (row) => row.id !== excludeScheduleId;

    const clashes = (row) => {
      const existingStart = ClassSchedule.timeToMinutes(row.start_hour);
      const existingMinutes = ClassSchedule.parseDurationToMinutes(row.duration) ?? 0;
      const existingEnd = existingStart + existingMinutes;

      const timeOverlaps = startMinutes < existingEnd && existingStart < newEnd;
      const datesOverlap = ClassSchedule.datesOverlap(
        effective_start_date,
        effective_end_date,
        row.effective_start_date,
        row.effective_end_date,
      );
      return timeOverlaps && datesOverlap;
    };

    const courseClash = courseRows.data.filter(notSelf).find(clashes);
    if (courseClash) {
      const start = ClassSchedule.formatMinutesAsClock(ClassSchedule.timeToMinutes(courseClash.start_hour));
      const end = ClassSchedule.formatMinutesAsClock(
        ClassSchedule.timeToMinutes(courseClash.start_hour) + (ClassSchedule.parseDurationToMinutes(courseClash.duration) ?? 0),
      );
      const err = new Error(
        `${courseClash.courses?.course_code ?? "This course"} already has a class at an overlapping time on that day (${start}–${end})`,
      );
      err.statusCode = 409;
      throw err;
    }

    if (venueRows.data.filter(notSelf).some(clashes)) {
      const err = new Error("This venue is already booked for an overlapping time slot");
      err.statusCode = 409;
      throw err;
    }

    if (!isFixed && String(schedule_type).toLowerCase() === "lecture") {
      const existingRecurringLecture = courseRows.data
        .filter(notSelf)
        .find(
          (row) =>
            !row.lecture_date &&
            String(row.schedule_type).toLowerCase() === "lecture" &&
            ClassSchedule.datesOverlap(
              effective_start_date,
              effective_end_date,
              row.effective_start_date,
              row.effective_end_date,
            ),
        );

      if (existingRecurringLecture) {
        const err = new Error(
          "This course already has a recurring lecture on that day. Schedule an extra lecture as a Fixed Class, or use a practical, tutorial or seminar.",
        );
        err.statusCode = 409;
        throw err;
      }
    }
  }

  // Creates either a recurring schedule (one row per day in `days`, running
  // across an effective date range) or, when `lecture_date` is given, a
  // single Fixed Class — a one-off on that one date. A Fixed Class is its
  // own row with its own id, so its session is independent of any
  // recurring slot (an ended session on the recurring row no longer blocks
  // a makeup); it's stored with its effective range collapsed to the one
  // date so it shows up on that date only.
  static async createSchedule(
    { course_id, schedule_type, venue_id, start_hour, duration, days, effective_start_date, effective_end_date, lecture_date },
    requestingLecturerId,
  ) {
    const isFixed = Boolean(lecture_date);

    if (!course_id || !venue_id || (!isFixed && !days?.length)) {
      const err = new Error(
        isFixed
          ? "course_id, venue_id, and lecture_date are required"
          : "course_id, venue_id, and at least one day are required",
      );
      err.statusCode = 400;
      throw err;
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, lecturer_id, course_code, course_name, department_id, level")
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

    const { startMinutes, durationMinutes, durationInterval } = ClassSchedule.resolveTimeSlot(start_hour, duration);

    const rows = [];

    if (isFixed) {
      ClassSchedule.validateFixedDate(lecture_date);
      const day_index = ClassSchedule.dayIndexOfDate(lecture_date);

      await ClassSchedule.assertSlotAvailable({
        course_id,
        venue_id,
        day_index,
        startMinutes,
        durationMinutes,
        effective_start_date: lecture_date,
        effective_end_date: lecture_date,
        schedule_type,
        isFixed: true,
      });

      rows.push({
        course_id,
        schedule_type,
        venue_id,
        start_hour,
        duration: durationInterval,
        day_index,
        lecture_date,
        effective_start_date: lecture_date,
        effective_end_date: lecture_date,
        is_active: true,
      });
    } else {
      if (effective_start_date && effective_end_date && effective_start_date > effective_end_date) {
        const err = new Error("effective_end_date can't be before effective_start_date");
        err.statusCode = 400;
        throw err;
      }

      for (const day of new Set(days)) {
        const day_index = DAY_MAP[day];
        if (day_index === undefined) {
          const err = new Error(`Invalid day: ${day}`);
          err.statusCode = 400;
          throw err;
        }

        await ClassSchedule.assertSlotAvailable({
          course_id,
          venue_id,
          day_index,
          startMinutes,
          durationMinutes,
          effective_start_date,
          effective_end_date,
          schedule_type,
          isFixed: false,
        });

        rows.push({
          course_id,
          schedule_type,
          venue_id,
          start_hour,
          duration: durationInterval,
          day_index,
          effective_start_date,
          effective_end_date,
          is_active: true,
        });
      }
    }

    const { data, error } = await supabaseAdmin.from("class_schedule").insert(rows).select();

    if (error) {
      const err = new Error(error.message || "Failed to create schedule");
      err.statusCode = 400;
      throw err;
    }

    // One notification per create call, even when several weekdays were
    // inserted. Awaited (it swallows its own errors) so the lecturer's
    // notification exists by the time the frontend refetches on success.
    await notifyScheduleCreated({
      course,
      course_id,
      schedule_type,
      venue_id,
      start_hour,
      duration: durationInterval,
      days: isFixed ? undefined : [...new Set(days)],
      lecture_date: isFixed ? lecture_date : undefined,
      effective_start_date: isFixed ? undefined : effective_start_date,
      effective_end_date: isFixed ? undefined : effective_end_date,
      requestingLecturerId,
    });

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

  // This function retrieves the schedule for a student based on their user ID. 
  // It first fetches the student's department and current level, then retrieves the 
  // courses they are enrolled in, and finally fetches the class schedule for those 
  // courses. The result is an array of schedule entries with course details included.
  static async getMyScheduleAsStudent(studentUserId) {
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
      .select("id, course_code, course_name")
      .eq("department_id", student.department_id)
      .eq("level", Number(student.current_level));

    if (coursesError) {
      const err = new Error(coursesError.message);
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
      .select("id, course_id, venue_id, schedule_type, day_index, start_hour, duration, lecture_date, effective_start_date, effective_end_date, courses(lecturer_id, course_code, course_name, department_id, level)")
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

    // A row with a lecture_date is a Fixed Class (a one-off on that date);
    // anything else is a recurring schedule. What's editable differs: a
    // recurring row edits its weekday + effective range, a Fixed Class
    // edits its single date (from which weekday and range follow). Whether
    // a row is fixed can't be changed by an edit.
    const isFixed = Boolean(schedule.lecture_date);

    // course_id is deliberately excluded, locked, never editable
    const allowedFields = isFixed
      ? ["schedule_type", "venue_id", "start_hour", "duration"]
      : ["schedule_type", "venue_id", "start_hour", "duration", "day_index", "effective_start_date", "effective_end_date"];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (!isFixed && updates.day_index !== undefined && typeof updates.day_index === "string" && DAY_MAP[updates.day_index] !== undefined) {
      safeUpdates.day_index = DAY_MAP[updates.day_index];
    }

    if (isFixed && updates.lecture_date !== undefined && updates.lecture_date !== schedule.lecture_date) {
      ClassSchedule.validateFixedDate(updates.lecture_date);
      safeUpdates.lecture_date = updates.lecture_date;
      safeUpdates.day_index = ClassSchedule.dayIndexOfDate(updates.lecture_date);
      safeUpdates.effective_start_date = updates.lecture_date;
      safeUpdates.effective_end_date = updates.lecture_date;
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error("No valid fields provided to update");
      err.statusCode = 400;
      throw err;
    }

    const mergedStartHour = safeUpdates.start_hour ?? schedule.start_hour;
    const { startMinutes, durationMinutes, durationInterval } = ClassSchedule.resolveTimeSlot(
      mergedStartHour,
      safeUpdates.duration ?? schedule.duration,
    );

    if (safeUpdates.duration !== undefined) safeUpdates.duration = durationInterval;

    const mergedEffectiveStart = safeUpdates.effective_start_date ?? schedule.effective_start_date;
    const mergedEffectiveEnd = safeUpdates.effective_end_date ?? schedule.effective_end_date;
    if (!isFixed && mergedEffectiveStart && mergedEffectiveEnd && mergedEffectiveStart > mergedEffectiveEnd) {
      const err = new Error("effective_end_date can't be before effective_start_date");
      err.statusCode = 400;
      throw err;
    }

    // Always re-run the full rule set against the merged result, not just
    // when a "conflict-relevant" field changed — changing only the type
    // (e.g. a practical to a lecture) can newly break the one-recurring-
    // lecture-per-day rule.
    await ClassSchedule.assertSlotAvailable({
      course_id: schedule.course_id,
      venue_id: safeUpdates.venue_id ?? schedule.venue_id,
      day_index: safeUpdates.day_index ?? schedule.day_index,
      startMinutes,
      durationMinutes,
      effective_start_date: mergedEffectiveStart,
      effective_end_date: mergedEffectiveEnd,
      schedule_type: safeUpdates.schedule_type ?? schedule.schedule_type,
      isFixed,
      excludeScheduleId: class_schedule_id,
    });

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

    await notifyScheduleRescheduled({
      schedule,
      class_schedule_id,
      safeUpdates,
      requestingLecturerId,
    });

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
      .select("id, course_id, schedule_type, lecture_date, courses(lecturer_id, course_code, course_name, department_id, level)")
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

    await notifyScheduleDeleted({ schedule, class_schedule_id, requestingLecturerId });

    return { message: "Schedule deleted successfully" };
  }
}

export default ClassSchedule;