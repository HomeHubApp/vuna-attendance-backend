import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const authRoutes = Router();

const otpGuessLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many attempts. Please try again later." },
});

const otpRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: "Too many requests. Please try again later." },
});


// Admin
authRoutes.post("/admin/create-user", authController.adminCreateUser);
authRoutes.post("/admin/users/:userId/regenerate-password", authController.regenerateDefaultPassword);

// Public
authRoutes.post("/login", authController.login);
authRoutes.post("/refresh", authController.refresh);
authRoutes.post("/logout", authController.logout);
authRoutes.post("/forgot-password", otpRequestLimiter, authController.forgotPassword);
authRoutes.post("/verify-reset-otp", otpGuessLimiter, authController.verifyResetOtp);
authRoutes.post("/reset-password", otpGuessLimiter, authController.resetPassword);

// Authenticated
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.post("/add-email", requireAuth, authController.addEmail);
authRoutes.post("/send-email-otp", requireAuth, otpRequestLimiter, authController.sendEmailVerificationOtp);
authRoutes.post("/verify-email-otp", requireAuth, otpGuessLimiter, authController.verifyEmailOtp);
authRoutes.post("/change-password", requireAuth, authController.changePassword);

export default authRoutes;