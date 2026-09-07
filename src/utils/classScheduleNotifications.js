import NotificationService from "../services/notificationService.js";

// This is for resolving who should be notified about a change to a course's class schedule.
// Placeholder: there is no student-course enrollment logic yet, so the lecturer who performed
// the action is the only recipient for now. Once students are tied to the courses their
// lecturer teaches, every student taking this course should be added to this list too.
export function getScheduleNotificationRecipients(lecturerId) {
  return [lecturerId];
}

// This is for notifying about a newly scheduled class
export async function notifyScheduleCreated({
  course,
  course_id,
  schedule_type,
  location,
  start_hour,
  duration,
  days,
  effective_start_date,
  effective_end_date,
  requestingLecturerId,
}) {
  try {
    await NotificationService.notify({
      type: "class_schedule.created",
      title: `New class scheduled: ${course.course_code}`,
      message: `${schedule_type || "A class"} for ${course.course_code} - ${course.course_name} was scheduled on ${days.join(", ")} at ${start_hour}${location ? `, ${location}` : ""}.`,
      relatedEntityType: "course",
      relatedEntityId: course_id,
      // This is for describing what was scheduled, so the notification is self-contained
      // without the recipient needing to look the course/schedule rows up separately
      payload: {
        course_id,
        course_code: course.course_code,
        course_name: course.course_name,
        schedule_type,
        location,
        start_hour,
        duration,
        days,
        effective_start_date,
        effective_end_date,
      },
      createdBy: requestingLecturerId,
      // Placeholder recipient list — see getScheduleNotificationRecipients above for why
      // this is just the lecturer for now
      recipientIds: getScheduleNotificationRecipients(requestingLecturerId),
    });
  } catch (notifyError) {
    console.error("Failed to send class_schedule.created notification:", notifyError.message);
  }
}

// This is for notifying about a rescheduled class
export async function notifyScheduleRescheduled({ schedule, class_schedule_id, safeUpdates, requestingLecturerId }) {
  try {
    await NotificationService.notify({
      type: "class_schedule.rescheduled",
      title: `Class schedule updated: ${schedule.courses.course_code}`,
      message: `The schedule for ${schedule.courses.course_code} - ${schedule.courses.course_name} has been updated.`,
      relatedEntityType: "class_schedule",
      relatedEntityId: class_schedule_id,
      // This is for describing what changed, so the notification is self-contained without
      // the recipient needing to look the schedule row up separately
      payload: {
        class_schedule_id,
        course_id: schedule.course_id,
        course_code: schedule.courses.course_code,
        course_name: schedule.courses.course_name,
        ...safeUpdates,
      },
      createdBy: requestingLecturerId,
      // Placeholder recipient list — see getScheduleNotificationRecipients above for why
      // this is just the lecturer for now
      recipientIds: getScheduleNotificationRecipients(requestingLecturerId),
    });
  } catch (notifyError) {
    console.error("Failed to send class_schedule.rescheduled notification:", notifyError.message);
  }
}

// This is for notifying about a cancelled class schedule
export async function notifyScheduleDeleted({ schedule, class_schedule_id, requestingLecturerId }) {
  try {
    await NotificationService.notify({
      type: "class_schedule.deleted",
      title: `Class schedule cancelled: ${schedule.courses.course_code}`,
      message: `The scheduled class for ${schedule.courses.course_code} - ${schedule.courses.course_name} has been cancelled.`,
      relatedEntityType: "class_schedule",
      relatedEntityId: class_schedule_id,
      // This is for describing what was cancelled, so the notification is self-contained
      // without the recipient needing to look the schedule row up separately
      payload: {
        class_schedule_id,
        course_id: schedule.course_id,
        course_code: schedule.courses.course_code,
        course_name: schedule.courses.course_name,
      },
      createdBy: requestingLecturerId,
      // Placeholder recipient list — see getScheduleNotificationRecipients above for why
      // this is just the lecturer for now
      recipientIds: getScheduleNotificationRecipients(requestingLecturerId),
    });
  } catch (notifyError) {
    console.error("Failed to send class_schedule.deleted notification:", notifyError.message);
  }
}
