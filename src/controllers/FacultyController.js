import Faculty from "../services/Facultyservices.js";
export const createFacultyController = async (req, res) => {
  try {
    const newFaculty = await Faculty.createFaculty(req.body);
    res.status(201).json({ success: true, data: newFaculty });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

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


export const updateFacultyController = async (req, res) => {
  try {
    const updatedFaculty = await Faculty.updateFaculty(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Faculty updated", data: updatedFaculty });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};



export const deleteFacultyController = async (req, res) => {
  try {
    const result = await Faculty.deleteFaculty(req.params.id);
    res.status(200).json({ success: true, message: result.message, data: result.deletedDepartment });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};