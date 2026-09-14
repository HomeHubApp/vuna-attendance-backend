import AcademicSession from "../services/academicSessionService.js";

// This is for creating a new academic session (Admin only, enforced at the route level)
export const createAcademicSession = async (req, res) => {
  try {
    const session = await AcademicSession.createAcademicSession(req.body, req.authUser.id);

    return res.status(201).json({
      message: "Academic session created successfully",
      data: session,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to create academic session",
    });
  }
};

// This is for fetching every academic session
export const getAcademicSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.getAllAcademicSessions();

    return res.status(200).json({
      message: "Academic sessions fetched successfully",
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch academic sessions",
    });
  }
};

// This is for editing an academic session (Admin only, enforced at the route level)
export const updateAcademicSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await AcademicSession.updateAcademicSession(id, req.body);

    return res.status(200).json({
      message: "Academic session updated successfully",
      data: updated,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to update academic session",
    });
  }
};
