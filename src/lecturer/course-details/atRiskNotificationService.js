/**
 * @file The lecturer's "Notify at-risk students" action: warns every student
 * of one of their courses who can no longer reach the exam attendance minimum,
 * by email and with an in-app notification.
 *
 * @remarks
 * The recipients are decided here on the server, from the course's own
 * attendance data — the request only names the course. The browser shows the
 * lecturer a preview, but it cannot choose or add recipients, so this can't
 * be used to email arbitrary students. The verdict is the attendance table's
 * (`AT_RISK` from `CourseDetails.getAttendanceMatrix`), so the students
 * warned are exactly the ones the table marks and the stat card counts.
 *
 * Two channels, deliberately: the email (`shared/email/sendEmail.js`) tells
 * the student now, and the in-app notification (`shared/notifications`) is a
 * copy they can find later, reaches students with no address on file, and is
 * the record this action keeps of having run — the cooldown below reads it.
 * Email is per-student (their own numbers); the in-app copy is one shared
 * message. The lecturer also gets an email copy afterwards — who was warned
 * and how delivery went for each — the one place a failed or address-less
 * student shows up in their inbox.
 *
 * TEMPORARY testing switch (`AT_RISK_NOTIFY_ALLOW_EMPTY_FOR_TESTING` in
 * `config/attendancePolicy.js`, currently on): with no student at risk the
 * action still runs, sends only the lecturer's test copy and creates no
 * in-app notification (so it also starts no cooldown). Turn it off to refuse
 * that case with a 400 again.
 *
 * Honest limits. Nothing is queued or retried: if an email fails, it is
 * reported back and the lecturer can see which students to follow up with —
 * but the cooldown then still applies to the whole course, and the in-app
 * copy has already gone out. Two requests arriving at the same instant can
 * both pass the cooldown check (the browser disables the button while
 * sending, which is what normally prevents that). The cooldown is a guard
 * against accidental repeats, not a permission system.
 *
 * Nothing that sends is called directly: `notify` and `sendEmails` are
 * parameters (defaulting to the real ones) so the whole flow can be
 * exercised without emailing anyone or writing notifications.
 */
import { supabaseAdmin } from "../../config/supabase.js";
import { AT_RISK_NOTIFY_ALLOW_EMPTY_FOR_TESTING, AT_RISK_NOTIFY_COOLDOWN_MINUTES } from "../../config/attendancePolicy.js";
import { sendEmailBatch } from "../../shared/email/sendEmail.js";
import NotificationService from "../../shared/notifications/notificationService.js";
import { failWith, fetchInChunks } from "../../shared/analytics/supabasePaging.js";
import CourseDetails from "./courseDetailsService.js";
import {
  AT_RISK_NOTIFICATION_TYPE,
  buildAtRiskInAppNotice,
  buildLecturerCopyEmail,
  cooldownMinutesRemaining,
  planAtRiskNotification,
} from "./atRiskNotificationCalculations.js";

const fail = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

class AtRiskNotification {
  /**
   * Warns the course's at-risk students.
   *
   * @param {string} lecturerId - auth user id of the logged-in lecturer; must teach the course.
   * @param {string} courseId
   * @param {object} [deps] - Replaceable for testing; defaults are the real ones.
   * @param {Date} [deps.now]
   * @param {(notification: object) => Promise<object>} [deps.notify] - Creates the in-app notification.
   * @param {(messages: Array<{ to: string, subject: string, html: string }>) => Promise<Array<{ ok: boolean, error?: string }>>} [deps.sendEmails]
   * @returns {Promise<{
   *   atRiskCount: number,
   *   inAppNotifiedCount: number,
   *   emailedCount: number,
   *   failedEmails: Array<{ studentId: string, fullName: string, error: string }>,
   *   noEmailAddress: Array<{ studentId: string, fullName: string }>,
   *   lecturerCopy: { status: "sent"|"failed"|"no_address", error?: string }
   * }>}
   *   `inAppNotifiedCount` is 0 if creating the in-app copy failed (logged,
   *   not fatal — the emails still go). Anyone in `failedEmails` or
   *   `noEmailAddress` was not emailed. `lecturerCopy` is how the lecturer's
   *   own copy went: "no_address" when their account has no email.
   * @throws {Error} 400 when `courseId` is missing, or nobody is at risk
   *   (unless the testing switch is on); 404 when the course isn't the
   *   lecturer's; 429 while the cooldown after the last alert hasn't passed.
   */
  static async notify(
    lecturerId,
    courseId,
    { now = new Date(), notify = (notification) => NotificationService.notify(notification), sendEmails = sendEmailBatch } = {}
  ) {
    // Ownership check and "who is at risk" both come from the attendance table.
    const matrix = await CourseDetails.getAttendanceMatrix(lecturerId, courseId);

    const atRiskIds = matrix.students.filter((student) => student.eligibility === "AT_RISK").map((student) => student.id);
    if (atRiskIds.length === 0 && !AT_RISK_NOTIFY_ALLOW_EMPTY_FOR_TESTING) fail("No students are at risk in this course", 400);

    await AtRiskNotification.#assertCooldownPassed(courseId, now);

    const [course, lecturer, usersById] = await Promise.all([
      AtRiskNotification.#fetchCourse(courseId),
      AtRiskNotification.#fetchLecturer(lecturerId),
      AtRiskNotification.#fetchUsers(atRiskIds),
    ]);

    const plan = planAtRiskNotification({ matrix, usersById, course, lecturerName: lecturer.fullName });

    // In-app first: it is also the cooldown's record, so it should exist even if emailing goes wrong.
    let inAppNotifiedCount = 0;
    // (Creating a notification needs at least one recipient, so the empty test case skips it.)
    if (plan.atRisk.length > 0) {
      try {
        const { title, message } = buildAtRiskInAppNotice({ ...course, minPercentageForExam: matrix.rules.minPercentageForExam });
        await notify({
          type: AT_RISK_NOTIFICATION_TYPE,
          title,
          message,
          relatedEntityType: "course",
          relatedEntityId: courseId,
          payload: {
            course_id: courseId,
            course_code: course.courseCode,
            course_name: course.courseTitle,
            min_attendance_percentage: matrix.rules.minPercentageForExam,
            min_classes_for_exam: matrix.rules.minClassesForExam,
          },
          createdBy: lecturerId,
          recipientIds: plan.atRisk.map((student) => student.id),
        });
        inAppNotifiedCount = plan.atRisk.length;
      } catch (notifyError) {
        console.error("Failed to create the at-risk in-app notification:", notifyError.message);
      }
    }

    const outcomes = plan.emails.length ? await sendEmails(plan.emails.map((email) => email.message)) : [];

    const failedEmails = [];
    plan.emails.forEach((email, index) => {
      if (!outcomes[index]?.ok) {
        failedEmails.push({ studentId: email.studentId, fullName: email.fullName, error: outcomes[index]?.error || "Failed to send email" });
      }
    });

    const lecturerCopy = await AtRiskNotification.#sendLecturerCopy({ lecturer, course, plan, failedEmails, sendEmails });

    return {
      atRiskCount: plan.atRisk.length,
      inAppNotifiedCount,
      emailedCount: plan.emails.length - failedEmails.length,
      failedEmails,
      noEmailAddress: plan.noAddress,
      lecturerCopy,
    };
  }

  /**
   * Emails the lecturer their copy: who was warned and how each delivery
   * went. Sent last so it can report the outcomes; a failure here is reported,
   * never thrown — the students have already been warned.
   */
  static async #sendLecturerCopy({ lecturer, course, plan, failedEmails, sendEmails }) {
    const to = lecturer.email?.trim();
    if (!to) return { status: "no_address" };

    const failedById = new Map(failedEmails.map((failure) => [failure.studentId, failure.error]));
    const noAddressIds = new Set(plan.noAddress.map((student) => student.studentId));
    const rows = plan.atRisk.map((student) => ({
      ...student,
      delivery: noAddressIds.has(student.id)
        ? { status: "no_address" }
        : failedById.has(student.id)
          ? { status: "failed", error: failedById.get(student.id) }
          : { status: "emailed" },
    }));

    const message = { to, ...buildLecturerCopyEmail({ lecturerName: lecturer.fullName, ...course, heldSessions: plan.heldSessions, rows }) };
    const [outcome] = await sendEmails([message]);
    return outcome?.ok ? { status: "sent" } : { status: "failed", error: outcome?.error || "Failed to send email" };
  }

  /** 429 while the course was alerted less than the cooldown ago. */
  static async #assertCooldownPassed(courseId, now) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("created_at")
      .eq("type", AT_RISK_NOTIFICATION_TYPE)
      .eq("related_entity_id", courseId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) failWith(error, "Failed to check earlier alerts");

    const minutesLeft = cooldownMinutesRemaining(data?.[0]?.created_at, now, AT_RISK_NOTIFY_COOLDOWN_MINUTES);
    if (minutesLeft > 0) {
      fail(
        `This course's at-risk students were already alerted recently. You can alert them again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        429
      );
    }
  }

  /** The course's code and title for the messages. */
  static async #fetchCourse(courseId) {
    const { data, error } = await supabaseAdmin.from("courses").select("course_code, course_name").eq("id", courseId).single();
    if (error) failWith(error, "Failed to fetch course");
    return { courseCode: data.course_code, courseTitle: data.course_name };
  }

  /** The lecturer's name and email address (either may be null). */
  static async #fetchLecturer(userId) {
    const { data, error } = await supabaseAdmin.from("users").select("full_name, email").eq("id", userId).maybeSingle();
    if (error) failWith(error, "Failed to fetch lecturer");
    return { fullName: data?.full_name ?? null, email: data?.email ?? null };
  }

  /** The students' user rows (just what the email needs), by id. */
  static async #fetchUsers(userIds) {
    const rows = await fetchInChunks(
      userIds,
      (idChunk) => supabaseAdmin.from("users").select("id, email").in("id", idChunk).order("id"),
      "Failed to fetch students' emails"
    );
    return new Map(rows.map((row) => [row.id, row]));
  }
}

export default AtRiskNotification;
