/**
 * @file Pure logic behind the lecturer's "Notify at-risk students" action:
 * how long a lecturer must wait before alerting a course again, what each
 * student is told, and who gets what (an email, an in-app notification, or
 * neither because there is no address).
 *
 * @remarks
 * No database access, no clock reads and no sending — `atRiskNotificationService.js`
 * gathers the rows, hands them here, and does the sending, so the wording and
 * the rules can be unit-tested without emailing anyone.
 *
 * Who is "at risk" is NOT decided here. It is the `AT_RISK` verdict the
 * attendance matrix already carries (`classifyEligibility` in
 * `shared/analytics/attendanceCalculations.js`): a student who can no longer
 * reach the exam minimum even by attending every class still to come. So the
 * students emailed are exactly the rows the table marks "At Risk" and the
 * number the stat card shows. A student who is merely behind is not warned.
 *
 * The email states facts the student can check — classes attended, classes
 * held, the minimum needed — and leaves the next step to the lecturer. It
 * names nobody but the recipient.
 */
import { escapeHtml } from "../../shared/email/sendEmail.js";

/** The `notifications.type` of the in-app copy of the alert. It also marks the alert as sent, for the cooldown. */
export const AT_RISK_NOTIFICATION_TYPE = "attendance.at_risk";

/**
 * Whole minutes a lecturer still has to wait before they may alert a course
 * again; 0 once the cooldown has passed (or if the course was never alerted).
 *
 * @param {string|Date|null|undefined} lastNotifiedAt - When the course's at-risk students were last alerted.
 * @param {Date} now
 * @param {number} cooldownMinutes
 * @returns {number} Rounded up, so "0 minutes left" is never shown while still blocked.
 */
export function cooldownMinutesRemaining(lastNotifiedAt, now, cooldownMinutes) {
  if (!lastNotifiedAt) return 0;
  const elapsedMinutes = (now.getTime() - new Date(lastNotifiedAt).getTime()) / 60000;
  return Math.max(0, Math.ceil(cooldownMinutes - elapsedMinutes));
}

/** "1 class" / "3 classes". */
const classes = (count) => `${count} ${count === 1 ? "class" : "classes"}`;

/**
 * The attendance-warning email for one student.
 *
 * @param {object} args
 * @param {string} args.studentName
 * @param {string} args.courseCode
 * @param {string} args.courseTitle
 * @param {string|null} args.lecturerName - Who is sending it; omitted from the text when unknown.
 * @param {{ attendedCount: number, heldSessions: number, attendancePercent: number, expectedClasses: number, minClassesForExam: number, minPercentageForExam: number }} args.facts
 * @returns {{ subject: string, html: string }} Every interpolated value is HTML-escaped.
 */
export function buildAtRiskEmail({ studentName, courseCode, courseTitle, lecturerName, facts }) {
  const { attendedCount, heldSessions, attendancePercent, expectedClasses, minClassesForExam, minPercentageForExam } = facts;
  const remaining = Math.max(0, expectedClasses - heldSessions);

  const remainingText =
    remaining === 0
      ? "No more classes are expected this semester, so that minimum can no longer be reached."
      : remaining === 1
        ? "Only 1 class is still expected this semester, so even attending it would not be enough to reach that minimum."
        : `Only ${remaining} classes are still expected this semester, so even attending every one of them would not be enough to reach that minimum.`;

  const from = lecturerName ? ` from your lecturer, ${escapeHtml(lecturerName)},` : "";

  return {
    subject: `Attendance warning: ${courseCode} — Veritas Attendance`,
    html: `
      <p>Hi ${escapeHtml(studentName)},</p>
      <p>This is an attendance warning${from} for <strong>${escapeHtml(courseCode)} – ${escapeHtml(courseTitle)}</strong>.</p>
      <p>So far you have attended <strong>${attendedCount} of ${classes(heldSessions)}</strong> held this semester (<strong>${attendancePercent}%</strong>).
      To be eligible for the exam you need to attend at least <strong>${minClassesForExam}</strong> of the ${expectedClasses} classes expected this semester (${minPercentageForExam}%).</p>
      <p>${remainingText}</p>
      <p>If you think this is wrong, or you want to talk about what you can do, please speak to your lecturer as soon as possible.</p>
    `,
  };
}

/**
 * The text of the in-app copy of the alert. The same for every student — an
 * in-app notification is one event shared by all its recipients — so the
 * personal numbers are only in the email.
 *
 * @param {{ courseCode: string, courseTitle: string, minPercentageForExam: number }} args
 * @returns {{ title: string, message: string }}
 */
export function buildAtRiskInAppNotice({ courseCode, courseTitle, minPercentageForExam }) {
  return {
    title: `Attendance warning: ${courseCode}`,
    message: `Your attendance in ${courseCode} – ${courseTitle} is too low to reach the ${minPercentageForExam}% exam minimum, even if you attend every remaining class. Please speak to your lecturer.`,
  };
}

/**
 * Works out who is alerted and what each of them is sent.
 *
 * @param {object} args
 * @param {{ sessions: Array, students: Array<{ id: string, fullName: string, attendance: string[], attendancePercent: number, eligibility: string }>, rules: { expectedClasses: number, minClassesForExam: number, minPercentageForExam: number } }} args.matrix
 *   The course's attendance matrix (`CourseDetails.getAttendanceMatrix`).
 * @param {Map<string, { email: string|null }>} args.usersById - The students' user rows.
 * @param {{ courseCode: string, courseTitle: string }} args.course
 * @param {string|null} args.lecturerName
 * @returns {{
 *   atRisk: Array<{ id: string, fullName: string }>,
 *   emails: Array<{ studentId: string, fullName: string, message: { to: string, subject: string, html: string } }>,
 *   noAddress: Array<{ studentId: string, fullName: string }>
 * }}
 *   `atRisk` is every student the table marks At Risk, in the table's order.
 *   Of those, `emails` are the ones with an address; `noAddress` are the rest
 *   — they still get the in-app notification.
 */
export function planAtRiskNotification({ matrix, usersById, course, lecturerName }) {
  const heldSessions = matrix.sessions.length;
  const atRisk = [];
  const emails = [];
  const noAddress = [];

  for (const student of matrix.students) {
    if (student.eligibility !== "AT_RISK") continue;

    atRisk.push({ id: student.id, fullName: student.fullName });

    const email = usersById.get(student.id)?.email?.trim();
    if (!email) {
      noAddress.push({ studentId: student.id, fullName: student.fullName });
      continue;
    }

    // "incomplete" still counts as attended, the same as in the percentage.
    const attendedCount = student.attendance.filter((status) => status === "present" || status === "incomplete").length;

    emails.push({
      studentId: student.id,
      fullName: student.fullName,
      message: {
        to: email,
        ...buildAtRiskEmail({
          studentName: student.fullName,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          lecturerName,
          facts: {
            attendedCount,
            heldSessions,
            attendancePercent: student.attendancePercent,
            expectedClasses: matrix.rules.expectedClasses,
            minClassesForExam: matrix.rules.minClassesForExam,
            minPercentageForExam: matrix.rules.minPercentageForExam,
          },
        }),
      },
    });
  }

  return { atRisk, emails, noAddress };
}
