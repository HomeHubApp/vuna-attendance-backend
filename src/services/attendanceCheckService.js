import { supabaseAdmin } from "../config/supabase.js";
import SessionAttendance from "./sessionAttendanceService.js";

const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES, 10) || 10; // default to 10 if not set
const CONSECUTIVE_FAIL_TO_FLAG = parseInt(process.env.CONSECUTIVE_FAIL_TO_FLAG, 10) || 2; // default to 2 if not set
const CONSECUTIVE_FAIL_TO_ABSENT = parseInt(process.env.CONSECUTIVE_FAIL_TO_ABSENT, 10) || 3; // default to 3 if not set    


function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ipToInt(ip) {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}


function isIpInCidr(ip, cidr) {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

class AttendanceCheck {
  static async checkIn({ class_session_id, latitude, longitude, ip_address, device_id }, studentId) {
    if (!class_session_id) {
      const err = new Error("class_session_id is required");
      err.statusCode = 400;
      throw err;
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("session_attendance")
      .select("id, status, consecutive_failed_checks")
      .eq("class_session_id", class_session_id)
      .eq("student_id", studentId)
      .single();

    if (attendanceError || !attendance) {
      const err = new Error("You have not joined this session");
      err.statusCode = 404;
      throw err;
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("class_sessions")
      .select("id, status, venue_id, venues(latitude, longitude, radius_meters)")
      .eq("id", class_session_id)
      .single();

    if (sessionError || !session) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }

    if (session.status !== "ACTIVE") {
      const err = new Error("This session is not currently active");
      err.statusCode = 400;
      throw err;
    }

    // Server-side minimum-interval enforcement — independent of the HTTP
    // rate limiter. Protects against a client distributing requests across
    // time (rather than bursting) to sail through the limiter while still
    // violating the actual 10-15 min check-in interval the architecture requires.
    const { data: lastCheck, error: lastCheckError } = await supabaseAdmin
      .from("attendance_checks")
      .select("checked_at")
      .eq("session_attendance_id", attendance.id)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCheckError) {
      const err = new Error(lastCheckError.message);
      err.statusCode = 500;
      throw err;
    }

    if (lastCheck) {
      const minutesSinceLastCheck = (Date.now() - new Date(lastCheck.checked_at).getTime()) / 60000;
      if (minutesSinceLastCheck < CHECK_INTERVAL_MINUTES) {
        const err = new Error("Next verification is not due yet");
        err.statusCode = 429;
        throw err;
      }
    }

    // GPS outcome
    let gps_outcome = "UNAVAILABLE";
    let distance = null;
    if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
      distance = haversineDistanceMeters(latitude, longitude, session.venues.latitude, session.venues.longitude);
      gps_outcome = distance <= session.venues.radius_meters ? "PASSED" : "FAILED";
    }

    // IP outcome — UNAVAILABLE (not FAILED) whenever we genuinely can't
    // evaluate: no IPv4 address, or no active ranges configured yet (see
    // BACKLOG.md — blocked on Veritas' real IP range from IT/networking).
    let ip_outcome = "UNAVAILABLE";
    if (ip_address && ip_address.includes(".")) {
      const { data: ranges, error: rangesError } = await supabaseAdmin
        .from("university_network_ranges")
        .select("cidr_range")
        .eq("is_active", true);

      if (rangesError) {
        const err = new Error(rangesError.message);
        err.statusCode = 500;
        throw err;
      }

      if (ranges && ranges.length > 0) {
        const matched = ranges.some((r) => isIpInCidr(ip_address, r.cidr_range));
        ip_outcome = matched ? "PASSED" : "FAILED";
      }
    }

    let overall_match;
    if (gps_outcome === "PASSED") {
      overall_match = true;
    } else if (ip_outcome === "PASSED") {
      overall_match = true;
    } else {
      overall_match = false;
    }

    const { data: check, error: checkError } = await supabaseAdmin
      .from("attendance_checks")
      .insert({
        session_attendance_id: attendance.id,
        gps_lat: latitude ?? null,
        gps_lng: longitude ?? null,
        distance_from_venue_meters: distance !== null ? Math.round(distance) : null,
        gps_outcome,
        ip_address: ip_address ?? null,
        ip_outcome,
        overall_match,
        device_id: device_id ?? null,
      })
      .select()
      .single();

    if (checkError) {
      const err = new Error(checkError.message);
      err.statusCode = 500;
      throw err;
    }

    const newConsecutiveFails = overall_match ? 0 : attendance.consecutive_failed_checks + 1;
    let newStatus = attendance.status;

    if (newConsecutiveFails >= CONSECUTIVE_FAIL_TO_ABSENT) {
      newStatus = "ABSENT";
    } else if (newConsecutiveFails >= CONSECUTIVE_FAIL_TO_FLAG) {
      newStatus = "FLAGGED";
    } else if (overall_match && attendance.status === "FLAGGED") {
      newStatus = "PRESENT"; // a pass after being flagged recovers status
    }

    const { error: updateError } = await supabaseAdmin
      .from("session_attendance")
      .update({ consecutive_failed_checks: newConsecutiveFails, status: newStatus })
      .eq("id", attendance.id);

    if (updateError) {
      const err = new Error(updateError.message);
      err.statusCode = 500;
      throw err;
    }

    if (newStatus !== attendance.status) {
      await SessionAttendance.recomputeHeadcount(class_session_id);
    }

    return { ...check, new_status: newStatus };
  }
}

export default AttendanceCheck;