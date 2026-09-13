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