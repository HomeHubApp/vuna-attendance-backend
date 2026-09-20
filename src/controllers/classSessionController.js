import ClassSession from "../services/classSessionService.js";

export const startSession = async (req, res) => {
    try {
        const session = await ClassSession.startSession(req.body, req.authUser.id);
        return res.status(201).json({ message: "Session started successfully", data: session });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to start session" });
    }
};

export const endSession = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await ClassSession.endSession(id, req.authUser.id);
        return res.status(200).json({ message: "Session ended successfully", data: session });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to end session" });
    }
};

export const getActiveSessions = async (req, res) => {
    try {
        const sessions = await ClassSession.getActiveSessions(req.authUser.id);
        return res.status(200).json({ data: sessions });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch active sessions" });
    }
};

export const getMySessions = async (req, res) => {
    try {
        const { from, to, status, limit } = req.query;
        const sessions = await ClassSession.getMySessions(req.authUser.id, { from, to, status, limit });
        return res.status(200).json({ data: sessions });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch sessions" });
    }
};

export const getActiveSessionsAsStudent = async (req, res) => {
    try {
        const sessions = await ClassSession.getActiveSessionsForStudent(req.authUser.id);
        return res.status(200).json({ data: sessions });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch active sessions" });
    }
};