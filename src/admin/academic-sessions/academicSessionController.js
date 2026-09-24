/**
 * @file HTTP layer for the Admin-only academic session actions (create,
 * update) — parses the request, calls `academicSessionService.js`, and maps
 * its thrown errors to a status code and JSON body. The read side
 * (`getAcademicSessions`) is `shared/academic-sessions/academicSessionController.js`.
 */
import AcademicSession from "../../shared/academic-sessions/academicSessionService.js";

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
