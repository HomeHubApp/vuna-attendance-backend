/**
 * @file HTTP layer for the Admin-only department actions (create, update,
 * delete) — parses the request, calls `departmentService.js`, and maps its
 * thrown errors to a status code and JSON body. The read side is
 * `shared/departments/departmentController.js`.
 */
import Department from "../../shared/departments/departmentService.js";

export const createDepartmentController = async (req, res) => {
  try {
    const newDept = await Department.createDepartment(req.body);
    res.status(201).json({ success: true, data: newDept });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const updateDepartmentController = async (req, res) => {
  try {
    const updatedDept = await Department.updateDepartment(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Department updated", data: updatedDept });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const deleteDepartmentController = async (req, res) => {
  try {
    const result = await Department.deleteDepartment(req.params.id);
    res.status(200).json({ success: true, message: result.message, data: result.deletedDepartment });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
