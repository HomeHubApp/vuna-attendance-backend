import ClassSchedule from "../services/classScheduleService.js";

export const createSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.createSchedule(
      req.body,
      req.authUser.id,
    );

    return res.status(201).json({
      message: "Schedule created successfully",
      count: schedule.length,
      data: schedule,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to create schedule",
    });
  }
};

export const getMySchedule = async (req, res) => {
  try {
    const schedules = await ClassSchedule.getMySchedules(req.authUser.id);

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

export const updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await ClassSchedule.updateSchedule(id, req.body, req.authUser.id);
        return res.status(200).json({ message: "Schedule updated successfully", data: updated });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to update schedule" });
    }
};

export const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await ClassSchedule.deleteSchedule(id, req.authUser.id);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to delete schedule" });
    }
};