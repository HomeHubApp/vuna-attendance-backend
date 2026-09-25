/**
 * @file Pure logic behind the lecturer Dashboard: which classes are on today
 * and what state each is in, each course's headline numbers, the weekly
 * attendance chart, and the review queue of records waiting for a decision.
 *
 * @remarks
 * No database access and no clock reads — `dashboardService.js` gathers the
 * rows and passes `now` and `today`, so every rule below is unit-testable on
 * its own (the same split `courseDetailsCalculations.js` and
 * `shared/analytics/attendanceCalculations.js` use).
 *
 * Nothing here invents a rule. Percentages, "held" and "at risk" come from
 * `shared/analytics/attendanceCalculations.js`; a record's bucket and its
 * verification issues from `shared/analytics/attendanceBuckets.js`; the week
 * numbering from `shared/analytics/teachingWeeks.js` — the same functions the
 * Courses page, Course Details and the roster use, so a number on the
 * Dashboard can't disagree with the page it summarises.
 *
 * Deliberately returns structured data, not display text: times are "HH:MM",
 * dates are ISO strings, and verification problems are the roster's own
 * phrases ("GPS Failed"). Turning them into sentences, colours and badges is
 * the frontend's job.
 */
import {
  computeAttendanceTrend,
  computeCourseAttendance,
  countsAsPresent,
  isSessionHeld,
} from "../../shared/analytics/attendanceCalculations.js";
import { buildVerificationIssues, classifyAttendanceBucket } from "../../shared/analytics/attendanceBuckets.js";
import { teachingWeekNumber } from "../../shared/analytics/teachingWeeks.js";

/** "HH:MM:SS" (or "HH:MM") -> total minutes since midnight. */
const toMinutes = (clock) => {
  const [hours, minutes] = String(clock).split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

/** Total minutes since midnight -> "HH:MM", wrapping past midnight. */
const toClock = (totalMinutes) => {
  const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
};

/**
 * Whether a schedule row has a class on a given calendar date: it must be
 * active, and either be a Fixed Class on exactly that date or a recurring row
 * whose weekday matches and whose effective range covers the date.
 *
 * @param {{ is_active: boolean, lecture_date: string|null, day_index: number, effective_start_date: string|null, effective_end_date: string|null }} row
 * @param {string} date - "YYYY-MM-DD".
 * @param {number} dayIndex - The date's weekday, 0 = Sunday … 6 = Saturday.
 * @returns {boolean}
 */
export function occursOnDate(row, date, dayIndex) {
  if (!row.is_active) return false;
  if (row.lecture_date) return row.lecture_date === date;
  return (
    row.day_index === dayIndex &&
    (!row.effective_start_date || date >= row.effective_start_date) &&
    (!row.effective_end_date || date <= row.effective_end_date)
  );
}

/**
 * Where one of today's classes stands.
 *
 * @param {object} args
 * @param {{ status: string }|null} args.session - The class's real session today, if the lecturer started one.
 * @param {string} args.scheduledEndAt - ISO timestamp the class was due to end.
 * @param {Date} args.now
 * @returns {"live"|"completed"|"missed"|"upcoming"}
 *   A real ACTIVE session is "live" and an ENDED one "completed", whatever the
 *   clock says. With no session, a class whose end has passed was "missed"
 *   (never started — the backend only lets a class start from its scheduled
 *   time), and one that hasn't yet ended is "upcoming" (including one already
 *   due to start).
 */
export function resolveScheduleStatus({ session, scheduledEndAt, now }) {
  if (session?.status === "ACTIVE") return "live";
  if (session?.status === "ENDED") return "completed";
  return now.getTime() >= new Date(scheduledEndAt).getTime() ? "missed" : "upcoming";
}

/**
 * Today's classes, in time order, each with its state.
 *
 * @param {object} args
 * @param {Array<object>} args.scheduleRows - Active `class_schedule` rows of the lecturer's courses, each
 *   with `course_code`, `course_name`, `venues: { name }|null`, and the two timestamps
 *   `scheduledStartAt` / `scheduledEndAt` for TODAY's occurrence (the service builds them with the same
 *   +01:00 helpers the session-start code uses).
 * @param {Array<{ id: string, class_schedule_id: string, status: string }>} args.todaysSessions - The lecturer's
 *   `class_sessions` dated today (any status).
 * @param {Map<string, number>} args.enrolledByCourse - Enrolled student count per course id.
 * @param {string} args.today - "YYYY-MM-DD" in the institution's time zone.
 * @param {number} args.dayIndex - Today's weekday, 0 = Sunday.
 * @param {Date} args.now
 * @returns {Array<{ id: string, classScheduleId: string, courseId: string, courseCode: string, courseTitle: string,
 *   venue: string|null, startTime: string, endTime: string, status: "live"|"completed"|"missed"|"upcoming",
 *   enrolled: number, progress: number|null, sessionId: string|null, date: string }>}
 *   `id` is the occurrence key (schedule id + date). `progress` is how far
 *   through its scheduled window a live class is (0–100), null otherwise.
 */
export function buildTodaysSchedule({ scheduleRows, todaysSessions, enrolledByCourse, today, dayIndex, now }) {
  const sessionBySchedule = new Map();
  for (const session of todaysSessions) {
    // A real running session wins over an ended one for the same class.
    const existing = sessionBySchedule.get(session.class_schedule_id);
    if (!existing || (session.status === "ACTIVE" && existing.status !== "ACTIVE")) {
      sessionBySchedule.set(session.class_schedule_id, session);
    }
  }

  return scheduleRows
    .filter((row) => occursOnDate(row, today, dayIndex))
    .sort((a, b) => toMinutes(a.start_hour) - toMinutes(b.start_hour))
    .map((row) => {
      const session = sessionBySchedule.get(row.id) ?? null;
      const status = resolveScheduleStatus({ session, scheduledEndAt: row.scheduledEndAt, now });

      const start = new Date(row.scheduledStartAt).getTime();
      const length = new Date(row.scheduledEndAt).getTime() - start;
      const progress =
        status === "live" && length > 0 ? Math.round(Math.max(0, Math.min(1, (now.getTime() - start) / length)) * 100) : null;

      return {
        id: `${row.id}:${today}`,
        classScheduleId: row.id,
        courseId: row.course_id,
        courseCode: row.course_code,
        courseTitle: row.course_name,
        venue: row.venues?.name ?? null,
        startTime: toClock(toMinutes(row.start_hour)),
        endTime: toClock(toMinutes(row.start_hour) + toMinutes(row.duration)),
        status,
        enrolled: enrolledByCourse.get(row.course_id) ?? 0,
        progress,
        sessionId: session?.id ?? null,
        date: today,
      };
    });
}

/**
 * One course's headline numbers — the same ones `GET /api/courses/mine/stats`
 * gives the Courses page, from the same shared maths.
 *
 * @param {object} args
 * @param {{ id: string, course_code: string, course_name: string }} args.course
 * @param {object[]} args.sessions - The course's ENDED sessions in the current term.
 * @param {object[]} args.attendanceRows - Attendance rows of those sessions.
 * @param {string[]} args.enrolledStudentIds - ENROLLED students.
 * @param {number} args.expectedClasses - Classes expected per semester.
 * @param {number} args.minPercent - The institution's minimum attendance, 0-100.
 * @param {Date} args.now
 * @returns {{ id: string, code: string, title: string, enrolled: number, attendancePercent: number|null,
 *   previousAttendancePercent: number|null, sessionsHeld: number, expectedClasses: number, studentsAtRisk: number }}
 *   Percentages are null when there is nothing to average (nobody enrolled,
 *   or no class held yet); `previousAttendancePercent` is the same a week ago.
 */
export function buildCourseFigures({ course, sessions, attendanceRows, enrolledStudentIds, expectedClasses, minPercent, now }) {
  const args = { sessions, attendanceRows, enrolledStudentIds, expectedClasses };
  const trend = computeAttendanceTrend(args, now);
  const { heldSessions, studentsAtRisk } = computeCourseAttendance({ ...args, asOf: now, minPercent });

  return {
    id: course.id,
    code: course.course_code,
    title: course.course_name,
    enrolled: enrolledStudentIds.length,
    attendancePercent: trend.current,
    previousAttendancePercent: trend.previous,
    sessionsHeld: heldSessions,
    expectedClasses,
    studentsAtRisk,
  };
}

/**
 * The lecturer's overall attendance across all their courses, and how it moved
 * over the past week.
 *
 * @param {Array<{ enrolled: number, attendancePercent: number|null, previousAttendancePercent: number|null }>} figures
 * @returns {{ percent: number|null, change: number|null }}
 *   Each course counts in proportion to its enrolled students, so a class of 80
 *   moves the figure more than a class of 8 — it is the average of every
 *   student's attendance, not of the course averages. Courses with nothing to
 *   average are left out. `change` is in percentage points (positive = up) and
 *   null unless both now and a week ago have a figure.
 */
export function combineAttendance(figures) {
  const weightedAverage = (pick) => {
    let total = 0;
    let weight = 0;
    for (const figure of figures) {
      const value = pick(figure);
      if (value === null) continue;
      total += value * figure.enrolled;
      weight += figure.enrolled;
    }
    return weight === 0 ? null : Math.round(total / weight);
  };

  const percent = weightedAverage((figure) => figure.attendancePercent);
  const previous = weightedAverage((figure) => figure.previousAttendancePercent);
  return { percent, change: percent === null || previous === null ? null : percent - previous };
}

/**
 * The weekly attendance chart: for each of the last `weekCount` teaching
 * weeks, each course's rate.
 *
 * @param {object} args
 * @param {Array<{ id: string, course_code: string }>} args.courses
 * @param {Map<string, object[]>} args.sessionsByCourse - Each course's ENDED sessions in the term.
 * @param {Map<string, object[]>} args.attendanceBySession - Attendance rows by `class_session_id`.
 * @param {Map<string, string[]>} args.enrolledIdsByCourse - ENROLLED student ids by course.
 * @param {string|null|undefined} args.termStartDate - Start of the current academic session, if it has one.
 * @param {string} args.today - "YYYY-MM-DD".
 * @param {number} args.weekCount - How many weeks to show, ending with the current one.
 * @returns {{ weeks: number[], series: Array<{ courseId: string, courseCode: string, rates: Array<number|null> }> }}
 *   A week's rate is the share of enrolled students who attended, averaged over
 *   the classes held that week: present ÷ (classes held × enrolled), capped at
 *   100. It is null for a week with no held class, and a course with no rate in
 *   any week is left out. Uses today's enrolled count for every week (enrolment
 *   history isn't kept), so a course whose class size changed shows a small
 *   distortion. Empty when the academic session has no start date to count
 *   weeks from.
 */
export function buildWeeklyAttendance({ courses, sessionsByCourse, attendanceBySession, enrolledIdsByCourse, termStartDate, today, weekCount }) {
  const currentWeek = teachingWeekNumber(today, termStartDate);
  if (currentWeek === null) return { weeks: [], series: [] };

  const firstWeek = Math.max(1, currentWeek - weekCount + 1);
  const weeks = Array.from({ length: currentWeek - firstWeek + 1 }, (_, index) => firstWeek + index);

  const series = courses
    .map((course) => {
      const enrolled = new Set(enrolledIdsByCourse.get(course.id) ?? []);
      const perWeek = new Map();

      for (const session of sessionsByCourse.get(course.id) ?? []) {
        if (!isSessionHeld(session)) continue;
        const week = teachingWeekNumber(session.session_date, termStartDate);
        if (week === null || week < firstWeek || week > currentWeek) continue;

        const entry = perWeek.get(week) ?? { sessions: 0, present: 0 };
        entry.sessions += 1;
        entry.present += (attendanceBySession.get(session.id) ?? []).filter(
          (row) => enrolled.has(row.student_id) && countsAsPresent(row.status)
        ).length;
        perWeek.set(week, entry);
      }

      const rates = weeks.map((week) => {
        const entry = perWeek.get(week);
        if (!entry || enrolled.size === 0) return null;
        return Math.min(100, Math.round((100 * entry.present) / (entry.sessions * enrolled.size)));
      });

      return { courseId: course.id, courseCode: course.course_code, rates };
    })
    .filter((entry) => entry.rates.some((rate) => rate !== null));

  return { weeks, series };
}

/**
 * The records still waiting for a lecturer's decision: Flagged, or
 * Incomplete (attended, but a verification check is unresolved), in held
 * sessions this term, for enrolled students, that no lecturer has ruled on.
 *
 * @param {object} args
 * @param {object[]} args.heldSessions - Sessions that count as held (`isSessionHeld`).
 * @param {object[]} args.attendanceRows - Attendance rows (with `id`, `status`, `overridden_at`).
 * @param {Map<string, object[]>} args.problemChecksByAttendanceId - Each row's unresolved failed/unavailable checks.
 * @param {Map<string, Set<string>>} args.enrolledSetByCourse - ENROLLED student ids by course.
 * @returns {Array<{ row: object, session: object, bucket: "Flagged"|"Incomplete" }>}
 *   Newest class first. A lecturer's override ends a record's pending state —
 *   it stamps `overridden_at` and resolves the row's checks — so it drops out.
 */
export function findPendingReviews({ heldSessions, attendanceRows, problemChecksByAttendanceId, enrolledSetByCourse }) {
  const sessionById = new Map(heldSessions.map((session) => [session.id, session]));
  const pending = [];

  for (const row of attendanceRows) {
    const session = sessionById.get(row.class_session_id);
    if (!session || row.overridden_at) continue;
    if (!enrolledSetByCourse.get(session.course_id)?.has(row.student_id)) continue;

    const bucket = classifyAttendanceBucket(row, problemChecksByAttendanceId.get(row.id) ?? []);
    if (bucket === "Flagged" || bucket === "Incomplete") pending.push({ row, session, bucket });
  }

  return pending.sort(
    (a, b) =>
      String(b.session.scheduled_start_at).localeCompare(String(a.session.scheduled_start_at)) || a.row.id.localeCompare(b.row.id)
  );
}

/**
 * The review queue as the Dashboard shows it: the newest pending records, each
 * with who, where, and why.
 *
 * @param {object} args
 * @param {ReturnType<typeof findPendingReviews>} args.pending
 * @param {number} args.limit - How many to return.
 * @param {Map<string, { code: string }>} args.courseById
 * @param {Map<string, { full_name: string, institution_identifier: string|null }>} args.usersById
 * @param {Map<string, object[]>} args.checksByAttendanceId - ALL checks of the listed rows (not just problems),
 *   so "Missing Final Check" and "Multiple Failed Checks" can be judged.
 * @param {number} args.lateThresholdMinutes
 * @param {number} args.checkIntervalMinutes
 * @returns {Array<{ id: string, sessionId: string, classScheduleId: string, courseId: string, courseCode: string,
 *   studentId: string, studentName: string, matricNo: string|null, status: "flagged"|"incomplete",
 *   issues: string[], sessionDate: string, scheduledStartAt: string }>}
 *   `issues` are the roster's own phrases and may be empty; the frontend
 *   words the reason from them.
 */
export function buildReviewQueue({ pending, limit, courseById, usersById, checksByAttendanceId, lateThresholdMinutes, checkIntervalMinutes }) {
  return pending.slice(0, limit).map(({ row, session, bucket }) => {
    const user = usersById.get(row.student_id);
    return {
      id: row.id,
      sessionId: session.id,
      classScheduleId: session.class_schedule_id,
      courseId: session.course_id,
      courseCode: courseById.get(session.course_id)?.code ?? "",
      studentId: row.student_id,
      studentName: user?.full_name ?? "Unknown student",
      matricNo: user?.institution_identifier ?? null,
      status: bucket === "Flagged" ? "flagged" : "incomplete",
      issues: buildVerificationIssues(row, checksByAttendanceId.get(row.id) ?? [], session, lateThresholdMinutes, checkIntervalMinutes),
      sessionDate: session.session_date,
      scheduledStartAt: session.scheduled_start_at,
    };
  });
}
