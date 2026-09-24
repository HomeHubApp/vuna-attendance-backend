/**
 * @file Mounts the auth feature: login, refresh, logout, the forgot-password
 * OTP flow, email verification, `/me`, and the two Admin-only account
 * endpoints (`create-user`, `regenerate-password`).
 *
 * @remarks
 * Auth is not a "role folder" like admin/lecturer/student — it is what every
 * role goes through before it has a role — so it has its own folder. The two
 * Admin endpoints stay here because they are thin wrappers over auth's own
 * service internals (password generation, welcome email).
 */
import authRoutes from "./authRoutes.js";

/**
 * Registers the auth routes on the Express app.
 *
 * @param {import("express").Express} app - The app to mount onto.
 */
export function mountAuthRoutes(app) {
  app.use("/api/auth", authRoutes);
}
