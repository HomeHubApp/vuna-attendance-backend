import express from "express";
import {
  createDepartmentController,
  getAllDepartmentsController,
  getDepartmentByIdController,
  updateDepartmentController,
  deleteDepartmentController,
} from "../controllers/departmentcontroller.js";

const router = express.Router();


router.post("/createdepartment", createDepartmentController);


router.get("/departments", getAllDepartmentsController);


router.get("/departments/:id", getDepartmentByIdController);


router.patch("/departments/:id", updateDepartmentController);

router.delete("/departments/:id", deleteDepartmentController);

export default router;