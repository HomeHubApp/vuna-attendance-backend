/**
 * @file Pure logic behind the Course Details page's overview — its header
 * block (the course dropdown, the facts line, the exam-rule line and the
 * average attendance badge) and the three stat cards under it: which course
 * is selected, the dropdown's options, the course's weekly timetable pattern,
 * and the assembled header and stats objects. (The attendance table under
 * them is `attendanceMatrixCalculations.js`.)
 *
 * @remarks
 * No database access and no clock reads — `courseDetailsService.js` gathers
 * the rows and hands them here, so every rule below is unit-testable on its
 * own, the same split `roster/rosterCalculations.js` and
 * `shared/analytics/attendanceCalculations.js` use.
 *
 * Deliberately returns structured data, not display text: the weekly pattern
 * is `[{ dayIndexes, startTime, endTime }]`, and the session is
 * `{ academicYear, semester }`. Turning those into "Mon / Wed · 10:00–12:00"
 * and "2026/2027 · Semester 1" is the frontend's job, the same way the
 * attendance percentage itself is computed here but formatted there.
 */
import { DEFAULT_EXPECTED_CLASSES, minClassesForExam } from "../../shared/analytics/attendanceCalculations.js";

/** Monday-first, matching how a timetable week reads (`day_index` itself is 0 = Sunday). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

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
 * The dropdown's entries: every course the lecturer teaches, sorted by
 * course code (the same order the Courses table uses).
 *
 * @param {Array<{ id: string, course_code: string, course_name: string }>} courses
 * @returns {Array<{ id: string, code: string, title: string }>}
 */
export function buildCourseOptions(courses) {
  return [...courses]
    .sort((a, b) => a.course_code.localeCompare(b.course_code))
    .map((course) => ({ id: course.id, code: course.course_code, title: course.course_name }));
}

/**
 * Which of the lecturer's courses the header should show: the one asked
 * for, or — when nothing was asked for — the first by course code.
 *
 * @param {Array<{ id: string, course_code: string }>} courses - The lecturer's own courses only.
 * @param {string|undefined} requestedId - The `courseId` the caller asked for, if any.
 * @returns {object|undefined} The chosen course, or undefined when a
 *   `requestedId` was given that isn't one of `courses` (or `courses` is empty).
 *   A requested id is never silently swapped for a different course.
 */
export function pickCourse(courses, requestedId) {
  if (requestedId) return courses.find((course) => course.id === requestedId);
  return [...courses].sort((a, b) => a.course_code.localeCompare(b.course_code))[0];
}

/**
 * The course's weekly pattern: its active, recurring timetable rows grouped
 * by time slot, so days that meet at the same time share one entry ("Mon and
 * Wed at 10:00–12:00"). Fixed Classes (one-off dates) aren't part of the
 * weekly pattern and are left out, as are deactivated rows. A course with no
 * qualifying row yields an empty list ("not scheduled").
 *
 * @param {Array<{ is_active: boolean, lecture_date: string|null, day_index: number, start_hour: string, duration: string }>} scheduleRows
 *   The course's `class_schedule` rows.
 * @returns {Array<{ dayIndexes: number[], startTime: string, endTime: string }>}
 *   Sorted by start time; `dayIndexes` are 0 = Sunday … 6 = Saturday, ordered Monday-first.
 */
export function buildScheduleSlots(scheduleRows) {
  const daysBySlot = new Map();

  for (const row of scheduleRows) {
    if (!row.is_active || row.lecture_date) continue;

    const start = toMinutes(row.start_hour);
    const slotKey = `${start}|${start + toMinutes(row.duration)}`;
    if (!daysBySlot.has(slotKey)) daysBySlot.set(slotKey, { start, end: start + toMinutes(row.duration), days: new Set() });
    daysBySlot.get(slotKey).days.add(row.day_index);
  }

  return [...daysBySlot.values()]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map(({ start, end, days }) => ({
      dayIndexes: WEEK_ORDER.filter((day) => days.has(day)),
      startTime: toClock(start),
      endTime: toClock(end),
    }));
}

/**
 * Assembles the selected course's header.
 *
 * @param {object} args
 * @param {{ id: string, course_code: string, course_name: string, credit_unit: number }} args.course
 * @param {string|null} args.departmentName - The owning department's name, or null.
 * @param {number} args.enrolledCount - Students with an ENROLLED enrollment.
 * @param {ReturnType<typeof buildScheduleSlots>} args.scheduleSlots
 * @param {{ academic_year: string, semester: number, min_attendance_percentage: number, expected_classes_per_semester?: number }} args.settings
 *   The institution's current settings row.
 * @param {{ percent: number|null, heldSessions: number }} args.attendance - From
 *   `computeCourseAttendance` (`shared/analytics/attendanceCalculations.js`):
 *   the course's average attendance and how many sessions count as held this term.
 * @returns {{
 *   id: string, code: string, title: string, department: string|null, units: number,
 *   totalEnrolled: number, scheduleSlots: Array, session: { academicYear: string, semester: number },
 *   totalClassesHeld: number, minClassesForExam: number, minPercentageForExam: number,
 *   avgAttendancePercentage: number|null
 * }}
 *   `avgAttendancePercentage` is null when there is nothing to average (no
 *   enrolled students, or no class held yet) — shown as a dash, never a fake 0%.
 */
export function buildCourseHeader({ course, departmentName, enrolledCount, scheduleSlots, settings, attendance }) {
  const expectedClasses = settings.expected_classes_per_semester ?? DEFAULT_EXPECTED_CLASSES;
  const minPercent = Number(settings.min_attendance_percentage);

  return {
    id: course.id,
    code: course.course_code,
    title: course.course_name,
    department: departmentName,
    units: course.credit_unit,
    totalEnrolled: enrolledCount,
    scheduleSlots,
    session: { academicYear: settings.academic_year, semester: settings.semester },
    totalClassesHeld: attendance.heldSessions,
    minClassesForExam: minClassesForExam(expectedClasses, minPercent),
    minPercentageForExam: minPercent,
    avgAttendancePercentage: attendance.percent,
  };
}

/**
 * The three headline numbers on the stat cards under the header.
 *
 * `totalStudents` and `avgAttendancePercentage` are the same figures the
 * header shows (enrolled students; the course's average attendance) — both
 * are derived from the same inputs in one place, so the two sections can't
 * disagree. `studentsAtRisk` is the stat cards' own number: enrolled students
 * who can NO LONGER reach the exam minimum even by attending every class
 * still to come (see `canStillQualify` in
 * `shared/analytics/attendanceCalculations.js`). Being behind early in the
 * semester is not "at risk"; being unable to catch up is.
 *
 * @param {object} args
 * @param {number} args.enrolledCount - Students with an ENROLLED enrollment.
 * @param {{ percent: number|null, studentsAtRisk: number|null }} args.attendance - From
 *   `computeCourseAttendance`, called with the institution's `minPercent` so
 *   `studentsAtRisk` is filled in.
 * @returns {{ totalStudents: number, studentsAtRisk: number|null, avgAttendancePercentage: number|null }}
 *   `avgAttendancePercentage` is null when there is nothing to average yet.
 *   `studentsAtRisk` is null only if the minimum percentage couldn't be read
 *   (never in practice — the column is NOT NULL).
 */
export function buildCourseStats({ enrolledCount, attendance }) {
  return {
    totalStudents: enrolledCount,
    studentsAtRisk: attendance.studentsAtRisk,
    avgAttendancePercentage: attendance.percent,
  };
}
