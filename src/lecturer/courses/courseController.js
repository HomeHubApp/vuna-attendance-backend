/**
 * @file HTTP layer for a lecturer's own courses and course stats — parses
 * the request, calls `courseService.js` / `courseStatsService.js`, and
 * maps thrown errors to a status code and JSON body. Course CRUD for other
 * roles lives in `admin/courses/courseController.js` (writes) and
 * `shared/courses/courseController.js` (reads).
 */
import Courses from "../../shared/courses/courseService.js";
import CourseStats from "./courseStatsService.js";

export const getMyCourses = async (req, res) => {
  try {
    const courses = await Courses.getMyCourses(req.authUser.id);
    return res.status(200).json({
      message: "Courses retrieved successfully",
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch your courses",
    });
  }
};

export const getMyCourseStats = async (req, res) => {
  try {
    const stats = await CourseStats.getMyCourseStats(req.authUser.id);
    return res.status(200).json({ message: "Course stats retrieved successfully", data: stats });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch your course stats",
    });
  }
};
