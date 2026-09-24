/**
 * @file HTTP layer for the read-only department endpoints, open to any
 * logged-in user — parses the request, calls `departmentService.js`, and
 * maps its thrown errors to a status code and JSON body. The Admin-only
 * writes are `admin/departments/departmentController.js`.
 */
import Department from "./departmentService.js";

export const getAllDepartmentsController = async (req, res) => {
  try {
    const departments = await Department.getAllDepartments();
    res.status(200).json({ success: true, count: departments.length, data: departments });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const getDepartmentByIdController = async (req, res) => {
  try {
    const department = await Department.getDepartmentById(req.params.id);
    res.status(200).json({ success: true, data: department });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
