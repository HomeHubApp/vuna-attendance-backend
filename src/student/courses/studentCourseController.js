/**
 * @file HTTP layer for `studentCourseService.js` — parses the request,
 * calls the service, and maps its thrown errors to a status code and JSON
 * body.
 */
import StudentCourse from "./studentCourseService.js";

export const getMyCourses = async (req, res) => {
  try {
    const courses = await StudentCourse.getMyCourses(req.authUser.id);
    return res.status(200).json({ message: "Courses fetched successfully", data: courses });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to fetch courses" });
  }
};

export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const enrollment = await StudentCourse.enroll(courseId, req.authUser.id);
    return res.status(200).json({ message: "Enrolled successfully", data: enrollment });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to enroll" });
  }
};

export const unenrollFromCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const result = await StudentCourse.unenroll(courseId, req.authUser.id);
    return res.status(200).json({ message: "Unenrolled successfully", data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, error: error.message || "Failed to unenroll" });
  }
};
