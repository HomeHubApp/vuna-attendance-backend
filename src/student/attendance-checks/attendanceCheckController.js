/**
 * @file HTTP layer for the student's location check-in
 * (`shared/attendance-checks/attendanceCheckService.js`) — parses the
 * request, calls the service, and maps its thrown errors to a status code
 * and JSON body.
 */
import AttendanceCheck from "../../shared/attendance-checks/attendanceCheckService.js";

export const checkIn = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, device_id } = req.body;
        const ip_address = req.ip;

        const result = await AttendanceCheck.checkIn(
            { class_session_id: id, latitude, longitude, ip_address, device_id },
            req.authUser.id
        );

        return res.status(201).json({ message: "Check-in recorded", data: result });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to record check-in" });
    }
};