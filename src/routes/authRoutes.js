import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const authRoutes = Router();

const otpGuessLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { error: "Too many attempts. Please try again later." },
});

const otpRequestLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: { error: "Too many requests. Please try again later." },
});


// Admin
/**
 * @swagger
 * /auth/admin/create-user:
 *   post:
 *     summary: Admin creates a new user account (student, lecturer, monitor, or admin)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, institution_identifier, role]
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: Jane Doe
 *               institution_identifier:
 *                 type: string
 *                 example: VUG/SWE/24/010
 *               role:
 *                 type: string
 *                 enum: [Student, Lecturer, Monitor, Admin]
 *               department_id:
 *                 type: string
 *                 format: uuid
 *                 description: Required for Student/Lecturer
 *               scope_type:
 *                 type: string
 *                 enum: [DEPARTMENT, FACULTY, UNIVERSITY]
 *                 description: Required for Monitor
 *               email:
 *                 type: string
 *                 description: Required (and must end in @veritas.edu.ng) for staff roles. Optional for students.
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing/invalid fields
 */
authRoutes.post("/admin/create-user", authController.adminCreateUser);
/**
 * @swagger
 * /auth/admin/users/{userId}/regenerate-password:
 *   post:
 *     summary: Admin regenerates a user's default password
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: New password generated (not returned in response for security)
 *       404:
 *         description: User not found
 */
authRoutes.post("/admin/users/:userId/regenerate-password", authController.regenerateDefaultPassword);

// Public
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with institution identifier (students) or Veritas email (staff)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution_identifier, password]
 *             properties:
 *               institution_identifier:
 *                 type: string
 *                 example: VUG/SWE/24/010
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful — sets access_token and refresh_token as httpOnly cookies
 *       401:
 *         description: Invalid credentials, or wrong login method for this account type
 */
authRoutes.post("/login", authController.login);
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh an expired access token using the refresh_token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Session refreshed, new cookies set
 *       401:
 *         description: Missing or invalid refresh token
 */
authRoutes.post("/refresh", authController.refresh);
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out and clear auth cookies
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
authRoutes.post("/logout", authController.logout);
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset code (requires an already-verified email on file)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution_identifier]
 *             properties:
 *               institution_identifier:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generic response returned regardless of whether the account exists (prevents enumeration)
 *       429:
 *         description: Too many requests
 */
authRoutes.post("/forgot-password", otpRequestLimiter, authController.forgotPassword);
/**
 * @swagger
 * /auth/verify-reset-otp:
 *   post:
 *     summary: Verify a password reset code (does not consume it — UX check only)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution_identifier, otp]
 *             properties:
 *               institution_identifier:
 *                 type: string
 *               otp:
 *                 type: string
 *                 example: "801223"
 *     responses:
 *       200:
 *         description: Code verified
 *       400:
 *         description: Missing/incorrect/expired/used/locked code
 *       429:
 *         description: Too many attempts
 */
authRoutes.post("/verify-reset-otp", otpGuessLimiter, authController.verifyResetOtp);
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a valid OTP (independently re-validates the code)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution_identifier, otp, newPassword]
 *             properties:
 *               institution_identifier:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 description: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Weak password or invalid/expired/used/locked code
 *       429:
 *         description: Too many attempts
 */
authRoutes.post("/reset-password", otpGuessLimiter, authController.resetPassword);

/**
 * @swagger
 * /auth/resend-reset-otp:
 *   post:
 *     summary: Resend the password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution_identifier]
 *             properties:
 *               institution_identifier:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generic response, same as forgot-password
 *       429:
 *         description: Too many requests
 */
authRoutes.post("/resend-reset-otp", otpRequestLimiter, authController.resendResetOtp);

// Authenticated
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the currently logged-in user's profile and roles
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile including roles array
 *       401:
 *         description: Not authenticated
 */
authRoutes.get("/me", requireAuth, authController.me);
/**
 * @swagger
 * /auth/add-email:
 *   post:
 *     summary: Add or update the logged-in user's email (resets verification)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email saved, needs verification
 *       400:
 *         description: Invalid email format
 *       401:
 *         description: Not authenticated
 */
authRoutes.post("/add-email", requireAuth, authController.addEmail);

/**
 * @swagger
 * /auth/send-email-otp:
 *   post:
 *     summary: Send an OTP to verify the logged-in user's email
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OTP sent (included in response body only when NODE_ENV=development)
 *       400:
 *         description: No email on file, or already verified
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Email failed to send
 */
authRoutes.post("/send-email-otp", requireAuth, otpRequestLimiter, authController.sendEmailVerificationOtp);

/**
 * @swagger
 * /auth/verify-email-otp:
 *   post:
 *     summary: Verify the email OTP
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "483291"
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Missing/incorrect/expired/used/locked code, or already verified
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Too many attempts
 */
authRoutes.post("/verify-email-otp", requireAuth, otpGuessLimiter, authController.verifyEmailOtp);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password for the logged-in user (e.g. after first login with default password)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *                 description: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Password fails validation rules
 *       401:
 *         description: Not authenticated
 */
authRoutes.post("/change-password", requireAuth, authController.changePassword);

/**
 * @swagger
 * /auth/resend-email-otp:
 *   post:
 *     summary: Resend the email verification OTP
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OTP resent
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Too many requests
 */
authRoutes.post("/resend-email-otp", requireAuth, otpRequestLimiter, authController.resendEmailOtp);


export default authRoutes;