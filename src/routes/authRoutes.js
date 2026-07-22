import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const authRoutes = Router();

authRoutes.post("/admin/create-user", authController.adminCreateUser);
authRoutes.post("/admin/users/:userId/regenerate-password", authController.regenerateDefaultPassword);

authRoutes.post("/login", authController.login);

authRoutes.get("/me", requireAuth, authController.me);
authRoutes.post("/add-email", requireAuth, authController.addEmail);
authRoutes.post("/send-email-otp", requireAuth, authController.sendEmailVerificationOtp);
authRoutes.post("/change-password", requireAuth, authController.changePassword);
authRoutes.post("/verify-email-otp", requireAuth, authController.verifyEmailOtp);

export default authRoutes;