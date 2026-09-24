/**
 * @file Background job: every 5 minutes, closes any `class_sessions` row
 * still `ACTIVE` past its scheduled end time — a lecturer who forgets to
 * end a class doesn't leave it open forever.
 *
 * @remarks
 * Lives in `src/jobs/`, alongside `missedCheckInMonitor.js`, rather than
 * under any role folder: it's a system-wide cron job, not an HTTP endpoint
 * a role calls. Started once from `index.js`.
 */
import cron from "node-cron";
import { supabaseAdmin } from "../config/supabase.js";

const CRON_SCHEDULE = "*/5 * * * *";

export function startAutoEndSessionsJob() {
  cron.schedule(CRON_SCHEDULE, async () => {
    const nowIso = new Date().toISOString();

    const { data: overdueSessions, error } = await supabaseAdmin
      .from("class_sessions")
      .select("id")
      .eq("status", "ACTIVE")
      .lt("scheduled_end_at", nowIso);

    if (error) {
      console.error("[autoEndSessions] Failed to fetch overdue sessions:", error.message);
      return;
    }

    if (!overdueSessions.length) return;

    const ids = overdueSessions.map((s) => s.id);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("class_sessions")
      .update({ status: "ENDED", actual_end_at: nowIso })
      .in("id", ids)
      .eq("status", "ACTIVE")
      .select("id");

    if (updateError) {
      console.error("[autoEndSessions] Failed to auto-end sessions:", updateError.message);
      return;
    }

    console.log(`[autoEndSessions] Auto-ended ${updated.length} session(s) past their scheduled end time.`);
  });

  console.log(`[autoEndSessions] Job scheduled: ${CRON_SCHEDULE}`);
}