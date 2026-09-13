import cron from "node-cron";
import { supabaseAdmin } from "../config/supabase.js";
import AttendanceCheck, { CHECK_INTERVAL_MINUTES } from "../services/attendanceCheckService.js";

const CRON_SCHEDULE = "*/5 * * * *"; 
const GRACE_MINUTES = CHECK_INTERVAL_MINUTES + 2;

export function startMissedCheckInMonitorJob() {
  cron.schedule(CRON_SCHEDULE, async () => {
    const { data: activeSessions, error: sessionsError } = await supabaseAdmin
      .from("class_sessions")
      .select("id")
      .eq("status", "ACTIVE");

    if (sessionsError) {
      console.error("[missedCheckInMonitor] Failed to fetch active sessions:", sessionsError.message);
      return;
    }
    if (!activeSessions.length) return;

    const sessionIds = activeSessions.map((s) => s.id);

    const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
      .from("session_attendance")
      .select("id, class_session_id, join_time, status, consecutive_failed_checks")
      .in("class_session_id", sessionIds)
      .in("status", ["PRESENT", "LATE", "FLAGGED"]);

    if (attendanceError) {
      console.error("[missedCheckInMonitor] Failed to fetch attendance rows:", attendanceError.message);
      return;
    }
    if (!attendanceRows.length) return;

    const attendanceIds = attendanceRows.map((a) => a.id);

    const { data: recentChecks, error: checksError } = await supabaseAdmin
      .from("attendance_checks")
      .select("session_attendance_id, checked_at")
      .in("session_attendance_id", attendanceIds)
      .order("checked_at", { ascending: false });

    if (checksError) {
      console.error("[missedCheckInMonitor] Failed to fetch recent checks:", checksError.message);
      return;
    }

    // Latest check per attendance row
    const lastCheckMap = new Map();
    for (const check of recentChecks) {
      if (!lastCheckMap.has(check.session_attendance_id)) {
        lastCheckMap.set(check.session_attendance_id, check.checked_at);
      }
    }

    const now = Date.now();
    let missedCount = 0;

    for (const attendance of attendanceRows) {
      const lastKnown = lastCheckMap.get(attendance.id) ?? attendance.join_time;
      const minutesSinceLastKnown = (now - new Date(lastKnown).getTime()) / 60000;

      if (minutesSinceLastKnown <= GRACE_MINUTES) continue;

      // Silence is treated exactly like a failed check — the system can't
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
  });

  console.log(`[missedCheckInMonitor] Job scheduled: ${CRON_SCHEDULE}`);
}