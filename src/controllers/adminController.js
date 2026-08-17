import * as adminService from "../services/adminService.js";

// ? Handles all admin operations


export async function getAllUsers(req, res) {
    try {
        const { role, search, page, limit } = req.query;
        const result = await adminService.getAllUsers({ role, search, page, limit });
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}
