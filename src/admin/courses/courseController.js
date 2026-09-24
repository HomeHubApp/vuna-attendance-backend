/**
 * @file HTTP layer for the Admin-only course actions (create, update,
 * delete) — parses the request, calls `courseService.js`, and maps its
 * thrown errors to a status code and JSON body. The read side is
 * `shared/courses/courseController.js`; a lecturer's own courses are
 * `lecturer/courses/courseController.js`.
 */
import Courses from "../../shared/courses/courseService.js";

export const createcourses = async (req, res) => {
  try {
    const create_course = await Courses.createcourses(req.body);

    return res
      .status(200)
      .json({ message: "course created successfully", data: create_course });
  } catch (err) {
    console.log(err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const updates = req.body;

    const updatedCourse = await Courses.updateCourse(courseId, updates);

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to update course",
    });
  }
};

export const deleteCourseController = async (req, res) => {
  try {
    const courseId = req.params.id;

    const result = await Courses.deleteCourse(courseId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.deletedCourse,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
