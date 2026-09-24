/**
 * @file HTTP layer for the read-only course endpoints, open to any
 * logged-in user — parses the request, calls `courseService.js`, and maps
 * its thrown errors to a status code and JSON body. The Admin-only writes
 * are `admin/courses/courseController.js`; a lecturer's own courses are
 * `lecturer/courses/courseController.js`.
 */
import Courses from "./courseService.js";

export const getcourses = async (req, res) => {
  try {
    const allCourses = await Courses.getAllCourses();

    return res.status(200).json({
      message: "Courses retrieved successfully",
      count: allCourses.length,
      data: allCourses,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);

    return res.status(status).json({ error: "failed to fetch courses" });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Courses.getCourseById(courseId);
    return res.status(200).json({
      success: true,
      message: "Course retrieved successfully",
      data: course,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch course",
    });
  }
};
