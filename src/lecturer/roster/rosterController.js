/**
 * @file HTTP layer for the Class Attendance Record ("roster") page —
 * parses the request, calls `rosterService.js`, and maps its thrown errors
 * to a status code and JSON body.
 */
import Roster from "./rosterService.js";

export const getRoster = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { scheduleId, date } = req.query;
    const roster = await Roster.getRoster(courseId, req.authUser.id, { scheduleId, date });
    return res.status(200).json({ message: "Roster fetched successfully", data: roster });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to fetch roster" });
  }
};
