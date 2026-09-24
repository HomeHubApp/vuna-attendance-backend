/**
 * @file Tunables for attendance behaviour, read from the environment with a
 * default.
 *
 * @remarks
 * The first three drive the live attendance verification loop, shared by the
 * check-in service, the missed-check monitor and the endpoint that tells a
 * student's device when its next check is due. They live in their own module
 * so `sessionAttendanceService.js` can read the interval without importing
 * `attendanceCheckService.js` (which itself imports
 * `sessionAttendanceService.js`). `AT_RISK_NOTIFY_COOLDOWN_MINUTES` guards the
 * lecturer's "Notify at-risk students" action.
 */
export const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES, 10) || 10;
export const CONSECUTIVE_FAIL_TO_FLAG = parseInt(process.env.CONSECUTIVE_FAIL_TO_FLAG, 10) || 2;
export const CONSECUTIVE_FAIL_TO_ABSENT = parseInt(process.env.CONSECUTIVE_FAIL_TO_ABSENT, 10) || 3;

/**
 * How long after a lecturer alerts a course's at-risk students before they can
 * alert them again. It stops a double click, or a retry after a slow response,
 * from emailing the same students twice; it is not a limit on how often
 * attendance can be reviewed.
 */
export const AT_RISK_NOTIFY_COOLDOWN_MINUTES = parseInt(process.env.AT_RISK_NOTIFY_COOLDOWN_MINUTES, 10) || 60;
