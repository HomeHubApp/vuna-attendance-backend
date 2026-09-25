/**
 * @file Which teaching week a date falls in, counted from the academic
 * session's start date.
 *
 * @remarks
 * Pure date maths, in `shared/` because two features number weeks the same way
 * and must agree: the Course Details attendance table's column headers
 * (`lecturer/course-details/attendanceMatrixCalculations.js`) and the
 * Dashboard's weekly attendance chart (`lecturer/dashboard/`). Dates are
 * calendar dates ("YYYY-MM-DD") and are compared as UTC midnights, so
 * daylight-saving changes and time zones can't shift a week.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" -> the UTC midnight of that calendar date, in ms. */
const dateToUtcMs = (isoDate) => {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

/**
 * The teaching week a date falls in: the start date's own week is week 1.
 *
 * @param {string} date - "YYYY-MM-DD".
 * @param {string|null|undefined} termStartDate - "YYYY-MM-DD" start of the current academic session, if it has one.
 * @returns {number|null} 1, 2, 3 …; null when the term has no start date or the date is before it.
 */
export function teachingWeekNumber(date, termStartDate) {
  if (!termStartDate) return null;
  const days = Math.floor((dateToUtcMs(date) - dateToUtcMs(termStartDate)) / MS_PER_DAY);
  return days < 0 ? null : Math.floor(days / 7) + 1;
}
