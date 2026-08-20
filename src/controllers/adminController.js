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

export async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { full_name, institution_identifier, email, department_id, status } = req.body;

        const updatedUser = await adminService.updateUser(id, {
            full_name,
            institution_identifier,
            email,
            department_id,
            status,
        });

        return res.status(200).json(updatedUser);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function deleteUser(req, res) {
    try {
        const { id } = req.params;

        const deletedUser = await adminService.deleteUser(id);

        return res.status(200).json({
            message: "User successfully deleted",
            deletedUser,
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}
