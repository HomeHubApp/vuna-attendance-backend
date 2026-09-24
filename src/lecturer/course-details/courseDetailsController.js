/**
 * @file HTTP layer for the Course Details page — parses the request, calls
 * `courseDetailsService.js`, and maps its thrown errors to a status code and
 * JSON body.
 */
import AtRiskNotification from "./atRiskNotificationService.js";
import CourseDetails from "./courseDetailsService.js";

export const getOverview = async (req, res) => {
  try {
    const { courseId } = req.query;
    const overview = await CourseDetails.getOverview(req.authUser.id, courseId);
    return res.status(200).json({ message: "Course details overview fetched successfully", data: overview });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to fetch course details overview" });
  }
};

export const getAttendanceMatrix = async (req, res) => {
  try {
    const { courseId } = req.query;
    const matrix = await CourseDetails.getAttendanceMatrix(req.authUser.id, courseId);
    return res.status(200).json({ message: "Course attendance matrix fetched successfully", data: matrix });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to fetch course attendance matrix" });
  }
};

export const notifyAtRisk = async (req, res) => {
  try {
    const { courseId } = req.body ?? {};
    const result = await AtRiskNotification.notify(req.authUser.id, courseId);
    return res.status(200).json({ message: "At-risk students notified", data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to notify at-risk students" });
  }
};
