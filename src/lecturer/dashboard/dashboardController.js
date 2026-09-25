/**
 * @file HTTP layer for the lecturer Dashboard — calls `dashboardService.js`
 * and maps its thrown errors to a status code and JSON body.
 */
import LecturerDashboard from "./dashboardService.js";

export const getDashboard = async (req, res) => {
  try {
    const dashboard = await LecturerDashboard.getDashboard(req.authUser.id);
    return res.status(200).json({ message: "Lecturer dashboard fetched successfully", data: dashboard });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to fetch the lecturer dashboard" });
  }
};
