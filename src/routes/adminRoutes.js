import * as adminController from "../controllers/adminController.js";
import { Router } from "express";

const adminRouter = Router();

adminRouter.get("/users", adminController.getAllUsers);

export default adminRouter;