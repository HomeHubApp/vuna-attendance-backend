/**
 * @file HTTP layer for a student finding the live sessions of their own
 * courses — parses the request, calls `classSessionService.js`, and maps
 * its thrown errors to a status code and JSON body. The lecturer's own
 * session lifecycle is `lecturer/class-sessions/classSessionController.js`.
 */
import ClassSession from "../../shared/class-sessions/classSessionService.js";

export const getActiveSessionsAsStudent = async (req, res) => {
    try {
        const sessions = await ClassSession.getActiveSessionsForStudent(req.authUser.id);
        return res.status(200).json({ data: sessions });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch active sessions" });
    }
};
