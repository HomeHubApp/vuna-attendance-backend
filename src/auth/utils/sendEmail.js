/**
 * @file Every outbound email auth sends — OTP codes, the welcome email for
 * a newly created account, and the notice when an Admin regenerates a
 * password.
 *
 * @remarks
 * Only the wording lives here; delivery (the Resend client, its
 * configuration and error handling) is `shared/email/sendEmail.js`, which
 * other features use too.
 */
import { sendEmail } from "../../shared/email/sendEmail.js";

/** Sends the OTP used for email verification and password reset. */
export async function sendOtpEmail(to, otp, purpose) {
    const subject = purpose === "EMAIL_VERIFICATION"
        ? "Verify your email — Veritas Attendance"
        : "Password reset code — Veritas Attendance";

    await sendEmail({
        to,
        subject,
        html: `
            <p>Your code is: <strong>${otp}</strong></p>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `,
    });

    console.log(`OTP email accepted by Resend: ${to} (${purpose})`);
}

/** Sends a new user their login ID and temporary password after an admin creates their account. */
export async function sendWelcomeEmail(to, { full_name, institution_identifier, default_password }) {
    await sendEmail({
        to,
        subject: "Welcome to Veritas Attendance System",
        html: `
            <p>Hi ${full_name},</p>
            <p>Your account has been created on the Veritas Attendance System.</p>
            <p><strong>Login ID:</strong> ${institution_identifier}</p>
            <p><strong>Temporary password:</strong> ${default_password}</p>
            <p>Please log in and change your password as soon as possible.</p>
            <p>If you weren't expecting this account, please contact your department administrator.</p>
        `,
    });
}

/** Tells a user their password was reset by an admin, with the new temporary password. */
export async function sendPasswordRegeneratedEmail(to, { full_name, institution_identifier, new_password }) {
    await sendEmail({
        to,
        subject: "Your password has been reset — Veritas Attendance System",
        html: `
            <p>Hi ${full_name},</p>
            <p>An administrator has reset your password on the Veritas Attendance System.</p>
            <p><strong>Login ID:</strong> ${institution_identifier}</p>
            <p><strong>New temporary password:</strong> ${new_password}</p>
            <p>Please log in and change your password as soon as possible.</p>
            <p>If you didn't expect this change, please contact your department administrator immediately.</p>
        `,
    });
}
