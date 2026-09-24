/**
 * @file HTTP layer for a student joining a live session and reading their
 * own active attendance — parses the request, calls
 * `sessionAttendanceService.js`, and maps its thrown errors to a status
 * code and JSON body. The lecturer's roster view is
 * `lecturer/session-attendance/sessionAttendanceController.js`.
 */
import SessionAttendance from "../../shared/session-attendance/sessionAttendanceService.js";

export const joinSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, device_id } = req.body;
        const ip_address = req.ip;

        const attendance = await SessionAttendance.joinSession(
            { class_session_id: id, latitude, longitude, ip_address, device_id },
            req.authUser.id
        );

        return res.status(201).json({ message: "Joined session successfully", data: attendance });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to join session" });
    }
};

export const getMyActiveAttendance = async (req, res) => {
    try {
        const { attendance, check_interval_minutes } = await SessionAttendance.getMyActiveAttendance(req.authUser.id);
        return res.status(200).json({ data: attendance, check_interval_minutes });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch your active attendance" });
    }
};
