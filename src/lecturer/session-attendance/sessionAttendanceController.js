/**
 * @file HTTP layer for a lecturer's roster of who joined a session they
 * started, and for overriding one student's status on it — parses the
 * request, calls `sessionAttendanceService.js`, and maps its thrown errors
 * to a status code and JSON body. The student-facing join/mine-active
 * actions are `student/session-attendance/sessionAttendanceController.js`.
 */
import SessionAttendance from "../../shared/session-attendance/sessionAttendanceService.js";

export const getSessionAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const attendance = await SessionAttendance.getSessionAttendance(id, req.authUser.id);
        return res.status(200).json({ data: attendance });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch session attendance" });
    }
};

export const overrideAttendance = async (req, res) => {
    try {
        const { id, studentId } = req.params;
        const { status, reason } = req.body;
        const attendance = await SessionAttendance.overrideAttendance(id, studentId, { status, reason }, req.authUser.id);
        return res.status(200).json({ message: "Attendance overridden successfully", data: attendance });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to override attendance" });
    }
};
