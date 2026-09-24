/**
 * @file Turns a class-schedule change (created, rescheduled, deleted) into
 * notifications for everyone affected, via `shared/notifications`.
 *
 * @remarks
 * Split out of `classScheduleService.js` so that file's own logic doesn't
 * get lost among notification-recipient lookups; both live in `shared/`
 * since they're called by the same schedule-mutation code.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import NotificationService from "../notifications/notificationService.js";

const clock = (time) => (time ? String(time).slice(0, 5) : "");

// Who should hear about a change to a course's class schedule: the acting
// lecturer, plus the students who actually have this class on their
// timetable. Students see a course's classes when its owning department +
// level match theirs (classScheduleService.getMyScheduleAsStudent), so
// those students are notified; anyone who has explicitly ENROLLED in the
// course (which is how a cross-listed student outside that department gets
// it) is added too. A student who has explicitly UNENROLLED is left out —
// they've opted out of the course, even though their timetable still lists
// it. A failed lookup is logged and skipped rather than aborting, so the
// lecturer always gets their notification.
export async function getScheduleNotificationRecipients({ courseId, departmentId, level, lecturerId }) {
  const recipients = new Set([lecturerId]);

  const [matched, enrolled, unenrolled] = await Promise.all([
    departmentId && level !== null && level !== undefined
      ? supabaseAdmin
          .from("students")
          .select("user_id")
          .eq("department_id", departmentId)
          .eq("current_level", String(level))
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("enrollments").select("student_id").eq("course_id", courseId).eq("status", "ENROLLED"),
    supabaseAdmin.from("enrollments").select("student_id").eq("course_id", courseId).eq("status", "UNENROLLED"),
  ]);

  for (const result of [matched, enrolled, unenrolled]) {
    if (result.error) console.error("Failed to resolve schedule notification recipients:", result.error.message);
  }

  const optedOut = new Set((unenrolled.data ?? []).map((row) => row.student_id));
  for (const row of matched.data ?? []) if (!optedOut.has(row.user_id)) recipients.add(row.user_id);
  for (const row of enrolled.data ?? []) recipients.add(row.student_id);

  return [...recipients];
}

// class_schedule stores venue_id, not a name — resolve it for the message.
async function resolveVenueName(venueId) {
  if (!venueId) return null;
  const { data } = await supabaseAdmin.from("venues").select("name").eq("id", venueId).maybeSingle();
  return data?.name ?? null;
}

// Friendly labels for the fields an edit can change, for the message text.
const CHANGE_LABELS = {
  schedule_type: "type",
  venue_id: "venue",
  start_hour: "start time",
  duration: "duration",
  day_index: "day",
  effective_start_date: "effective period",
  effective_end_date: "effective period",
  lecture_date: "date",
};

// This is for notifying about a newly scheduled class — recurring (`days`
// plus an effective range) or a one-off Fixed Class (`lecture_date`).
// `course` needs course_code, course_name, department_id and level.
export async function notifyScheduleCreated({
  course,
  course_id,
  schedule_type,
  venue_id,
  start_hour,
  duration,
  days,
  lecture_date,
  effective_start_date,
  effective_end_date,
  requestingLecturerId,
}) {
  try {
    const venue = await resolveVenueName(venue_id);
    const isFixed = Boolean(lecture_date);
    const where = venue ? `, ${venue}` : "";
    const what = `${course.course_code} - ${course.course_name}`;

    await NotificationService.notify({
      type: "class_schedule.created",
      title: isFixed ? `New Fixed Class scheduled: ${course.course_code}` : `New class scheduled: ${course.course_code}`,
      message: isFixed
        ? `A Fixed Class (${schedule_type || "class"}) for ${what} was scheduled on ${lecture_date} at ${clock(start_hour)}${where}.`
        : `${schedule_type || "A class"} for ${what} was scheduled on ${days.join(", ")} at ${clock(start_hour)}${where}.`,
      relatedEntityType: "course",
      relatedEntityId: course_id,
      // Self-contained so the recipient doesn't need to look the schedule
      // row up; NotificationDetailPage renders these keys as-is.
      payload: {
        course_id,
        course_code: course.course_code,
        course_name: course.course_name,
        schedule_type,
        venue,
        start_hour: clock(start_hour),
        duration,
        ...(isFixed ? { lecture_date } : { days, effective_start_date, effective_end_date }),
      },
      createdBy: requestingLecturerId,
      recipientIds: await getScheduleNotificationRecipients({
        courseId: course_id,
        departmentId: course.department_id,
        level: course.level,
        lecturerId: requestingLecturerId,
      }),
    });
  } catch (notifyError) {
    console.error("Failed to send class_schedule.created notification:", notifyError.message);
  }
}

// This is for notifying about an edited class (recurring or Fixed).
// `schedule.courses` needs course_code, course_name, department_id, level.
export async function notifyScheduleRescheduled({ schedule, class_schedule_id, safeUpdates, requestingLecturerId }) {
  try {
    const isFixed = Boolean(schedule.lecture_date);
    // On a Fixed Class the weekday and effective range are just derived
    // from its date, so they're not reported as separate changes.
    const derivedForFixed = ["day_index", "effective_start_date", "effective_end_date"];
    const reportable = isFixed
      ? Object.fromEntries(Object.entries(safeUpdates).filter(([key]) => !derivedForFixed.includes(key)))
      : safeUpdates;
    const changed = [...new Set(Object.keys(reportable).map((key) => CHANGE_LABELS[key]).filter(Boolean))];
    const what = `${schedule.courses.course_code} - ${schedule.courses.course_name}`;
    const venue = safeUpdates.venue_id ? await resolveVenueName(safeUpdates.venue_id) : null;

    await NotificationService.notify({
      type: "class_schedule.rescheduled",
      title: `${isFixed ? "Fixed Class" : "Class schedule"} updated: ${schedule.courses.course_code}`,
      message: `The ${isFixed ? "Fixed Class" : "schedule"} for ${what} has been updated${
        changed.length ? ` (${changed.join(", ")})` : ""
      }.`,
      relatedEntityType: "class_schedule",
      relatedEntityId: class_schedule_id,
      payload: {
        class_schedule_id,
        course_id: schedule.course_id,
        course_code: schedule.courses.course_code,
        course_name: schedule.courses.course_name,
        ...reportable,
        ...(venue ? { venue } : {}),
      },
      createdBy: requestingLecturerId,
      recipientIds: await getScheduleNotificationRecipients({
        courseId: schedule.course_id,
        departmentId: schedule.courses.department_id,
        level: schedule.courses.level,
        lecturerId: requestingLecturerId,
      }),
    });
  } catch (notifyError) {
    console.error("Failed to send class_schedule.rescheduled notification:", notifyError.message);
  }
}

// This is for notifying about a deleted (cancelled) class schedule.
// `schedule.courses` needs course_code, course_name, department_id, level.
export async function notifyScheduleDeleted({ schedule, class_schedule_id, requestingLecturerId }) {
  try {
    const isFixed = Boolean(schedule.lecture_date);
    const what = `${schedule.courses.course_code} - ${schedule.courses.course_name}`;

    await NotificationService.notify({
      type: "class_schedule.deleted",
      title: `${isFixed ? "Fixed Class" : "Class schedule"} cancelled: ${schedule.courses.course_code}`,
      message: isFixed
        ? `The Fixed Class for ${what} on ${schedule.lecture_date} has been cancelled.`
        : `The scheduled class for ${what} has been cancelled.`,
      relatedEntityType: "class_schedule",
      relatedEntityId: class_schedule_id,
      payload: {
        class_schedule_id,
        course_id: schedule.course_id,
        course_code: schedule.courses.course_code,
        course_name: schedule.courses.course_name,
        schedule_type: schedule.schedule_type,
        ...(isFixed ? { lecture_date: schedule.lecture_date } : {}),
      },
      createdBy: requestingLecturerId,
      recipientIds: await getScheduleNotificationRecipients({
        courseId: schedule.course_id,
        departmentId: schedule.courses.department_id,
        level: schedule.courses.level,
        lecturerId: requestingLecturerId,
      }),
    });
  } catch (notifyError) {
    console.error("Failed to send class_schedule.deleted notification:", notifyError.message);
  }
}
