/**
 * @file HTTP layer for the read-only faculty endpoints, open to any
 * logged-in user — parses the request, calls `facultyService.js`, and maps
 * its thrown errors to a status code and JSON body. The Admin-only writes
 * are `admin/faculties/facultyController.js`.
 */
import Faculty from "./facultyService.js";

export const getAllFacultiesController = async (req, res) => {
  try {
    const faculties = await Faculty.getFaculty();
    res.status(200).json({ success: true, count: faculties.length, data: faculties });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const getFacultyByIdController = async (req, res) => {
  try {
    const faculty = await Faculty.getFacultyById(req.params.id);
    res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
