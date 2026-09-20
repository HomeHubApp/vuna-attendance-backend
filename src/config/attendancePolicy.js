// Tunables for the live attendance verification loop, shared by the
// check-in service, the missed-check monitor and the endpoint that tells a
// student's device when its next check is due. Lives in its own module so
// sessionAttendanceService.js can read the interval without importing
// attendanceCheckService.js (which itself imports sessionAttendanceService.js).
export const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES, 10) || 10;
export const CONSECUTIVE_FAIL_TO_FLAG = parseInt(process.env.CONSECUTIVE_FAIL_TO_FLAG, 10) || 2;
export const CONSECUTIVE_FAIL_TO_ABSENT = parseInt(process.env.CONSECUTIVE_FAIL_TO_ABSENT, 10) || 3;
