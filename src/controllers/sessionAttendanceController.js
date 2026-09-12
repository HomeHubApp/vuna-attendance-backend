import SessionAttendance from "../services/sessionAttendanceService.js";

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