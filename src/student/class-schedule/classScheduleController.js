/**
 * @file HTTP layer for a student's own timetable — parses the request,
 * calls `classScheduleService.js`, and maps its thrown errors to a status
 * code and JSON body. The lecturer's own schedule management is
 * `lecturer/class-schedule/classScheduleController.js`.
 */
import ClassSchedule from "../../shared/class-schedule/classScheduleService.js";

export const getMyScheduleAsStudent = async (req, res) => {
  try {
    const schedules = await ClassSchedule.getMyScheduleAsStudent(req.authUser.id);

    return res.status(200).json({
      message: "Schedules fetched successfully",
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch schedules",
    });
  }
};
