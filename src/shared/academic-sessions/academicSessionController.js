/**
 * @file HTTP layer for the read-only academic-session listing, open to any
 * logged-in user — parses the request, calls `academicSessionService.js`,
 * and maps its thrown errors to a status code and JSON body. The
 * Admin-only writes (create, update) are `admin/academic-sessions/academicSessionController.js`.
 */
import AcademicSession from "./academicSessionService.js";

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
