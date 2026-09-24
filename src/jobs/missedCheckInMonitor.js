/**
 * @file Background job: every 5 minutes, treats a joined student's silence
 * (no check-in received when one was due) as a failed check, via
 * `shared/attendance-checks/attendanceCheckService.js`'s `applyCheckOutcome`.
 *
 * @remarks
 * Lives in `src/jobs/`, alongside `autoEndSessions.js`, rather than under
 * any role folder: it's a system-wide cron job, not an HTTP endpoint a role
 * calls. Started once from `index.js`.
 */
import cron from "node-cron";
import { supabaseAdmin } from "../config/supabase.js";
import AttendanceCheck, { CHECK_INTERVAL_MINUTES } from "../shared/attendance-checks/attendanceCheckService.js";

const CRON_SCHEDULE = "*/5 * * * *";
const TICK_MS = 5 * 60 * 1000;
const GRACE_MINUTES = CHECK_INTERVAL_MINUTES + 2;
const GRACE_MS = GRACE_MINUTES * 60 * 1000;

// Between-run memory for the downtime guard below. A run that arrives more
// than two ticks after the previous one (or the very first run after the
// server boots) means the job wasn't running for a while — a student
// can't be blamed for silence while the server itself was down, since their
// check-ins had nowhere to land.
const monitorState = { lastTickAt: null, graceUntil: 0 };

// One monitor pass. Treats a joined student's silence as a failed check —
// but only for sessions still inside their scheduled window, and only once
// the server has been up long enough for a student's device to have sent
// a check-in. Exported (with an injectable clock and state) so the rules
// can be exercised directly instead of only through the cron schedule.
export async function runMissedCheckInMonitor({ now = Date.now(), state = monitorState } = {}) {
  if (state.lastTickAt === null || now - state.lastTickAt > 2 * TICK_MS) {
    state.graceUntil = now + GRACE_MS;
  }
  state.lastTickAt = now;

  if (now < state.graceUntil) return { skipped: "grace-after-restart", missed: 0 };

  // Sessions past their scheduled end are left alone: autoEndSessions
  // closes them, and judging attendance inside that same instant races
  // its update (a check could be recorded against a session that ended a
  // moment earlier) — which is how a phantom failure once landed on an
  // already-ended session.
  const { data: activeSessions, error: sessionsError } = await supabaseAdmin
    .from("class_sessions")
    .select("id")
    .eq("status", "ACTIVE")
    .gt("scheduled_end_at", new Date(now).toISOString());

  if (sessionsError) {
    console.error("[missedCheckInMonitor] Failed to fetch active sessions:", sessionsError.message);
    return { skipped: "error", missed: 0 };
  }
  if (!activeSessions.length) return { skipped: "no-active-sessions", missed: 0 };

  const sessionIds = activeSessions.map((s) => s.id);

  const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
    .from("session_attendance")
    .select("id, class_session_id, join_time, status, consecutive_failed_checks")
    .in("class_session_id", sessionIds)
    .in("status", ["PRESENT", "LATE", "FLAGGED"]);

  if (attendanceError) {
    console.error("[missedCheckInMonitor] Failed to fetch attendance rows:", attendanceError.message);
    return { skipped: "error", missed: 0 };
  }
  if (!attendanceRows.length) return { skipped: "no-attendance", missed: 0 };

  const attendanceIds = attendanceRows.map((a) => a.id);

  const { data: recentChecks, error: checksError } = await supabaseAdmin
    .from("attendance_checks")
    .select("session_attendance_id, checked_at")
    .in("session_attendance_id", attendanceIds)
    .order("checked_at", { ascending: false });

  if (checksError) {
    console.error("[missedCheckInMonitor] Failed to fetch recent checks:", checksError.message);
    return { skipped: "error", missed: 0 };
  }

  // Latest check per attendance row
  const lastCheckMap = new Map();
  for (const check of recentChecks) {
    if (!lastCheckMap.has(check.session_attendance_id)) {
      lastCheckMap.set(check.session_attendance_id, check.checked_at);
    }
  }

  let missedCount = 0;

  for (const attendance of attendanceRows) {
    const lastKnown = lastCheckMap.get(attendance.id) ?? attendance.join_time;
    const minutesSinceLastKnown = (now - new Date(lastKnown).getTime()) / 60000;

    if (minutesSinceLastKnown <= GRACE_MINUTES) continue;

    // Silence is treated exactly like a failed check — the system can't
    // tell "no signal" from "left the room".
    const { error: insertError } = await supabaseAdmin.from("attendance_checks").insert({
      session_attendance_id: attendance.id,
      gps_outcome: "UNAVAILABLE",
      ip_outcome: "UNAVAILABLE",
      overall_match: false,
    });

    if (insertError) {
      console.error(`[missedCheckInMonitor] Failed to record missed check for ${attendance.id}:`, insertError.message);
      continue;
    }

    await AttendanceCheck.applyCheckOutcome(attendance, false, attendance.class_session_id);
    missedCount++;
  }

  if (missedCount > 0) {
    console.log(`[missedCheckInMonitor] Recorded ${missedCount} missed check-in(s) this run.`);
  }
  return { skipped: null, missed: missedCount };
}

export function startMissedCheckInMonitorJob() {
  cron.schedule(CRON_SCHEDULE, () => {
    runMissedCheckInMonitor().catch((error) => {
      console.error("[missedCheckInMonitor] Run failed:", error.message);
    });
  });

  console.log(`[missedCheckInMonitor] Job scheduled: ${CRON_SCHEDULE}`);
}
