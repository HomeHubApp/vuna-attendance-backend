/**
 * @file The periodic location check-in a joined student's device submits
 * while a class is live: verifies it against the venue and updates the
 * student's `session_attendance` status accordingly.
 *
 * @remarks
 * Lives in `shared/` (not `student/`, even though only the student-facing
 * `POST /:id/check-in` route calls `checkIn` today) because
 * `jobs/missedCheckInMonitor.js` — a system-wide background job, not a
 * role — also imports from here (`applyCheckOutcome`, `CHECK_INTERVAL_MINUTES`).
 */
import { supabaseAdmin } from "../../config/supabase.js";
import SessionAttendance from "../session-attendance/sessionAttendanceService.js";

import {
  CHECK_INTERVAL_MINUTES,
  CONSECUTIVE_FAIL_TO_FLAG,
  CONSECUTIVE_FAIL_TO_ABSENT,
} from "../../config/attendancePolicy.js";

// Re-exported so existing importers (missedCheckInMonitor.js) keep working.
export { CHECK_INTERVAL_MINUTES };

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

// IPv4-only
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

    let gps_outcome = "UNAVAILABLE";
    let distance = null;
    if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
      distance = haversineDistanceMeters(latitude, longitude, session.venues.latitude, session.venues.longitude);
      gps_outcome = distance <= session.venues.radius_meters ? "PASSED" : "FAILED";
    }

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

    const result = await AttendanceCheck.applyCheckOutcome(attendance, overall_match, class_session_id);

    return { ...check, new_status: result.newStatus };
  }

  static async applyCheckOutcome(attendance, overall_match, class_session_id) {
    const newConsecutiveFails = overall_match ? 0 : attendance.consecutive_failed_checks + 1;
    let newStatus = attendance.status;

    if (newConsecutiveFails >= CONSECUTIVE_FAIL_TO_ABSENT) {
      newStatus = "ABSENT";
    } else if (newConsecutiveFails >= CONSECUTIVE_FAIL_TO_FLAG) {
      newStatus = "FLAGGED";
    } else if (overall_match && attendance.status === "FLAGGED") {
      newStatus = "PRESENT";
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

    return { newConsecutiveFails, newStatus };
  }
}

export default AttendanceCheck;

//session semeter course enrollment

//auto enrollment instsad of enriolling for a course them siekve . when ever onboarede t eocurses is austomatically assigned
//we mught need to ulter he courses. we might need to add a session by session logic (2025, 2026) adn semester


//on admin they updtae the cureent session-sememter- global 
//so they automatically

//so basiclaly a new table for session, right now you enrollfor a course as a studnet but we dont enat tht we want it to be done automcaticlly formth edmain panil while also accomat=dation sessionadn semeter