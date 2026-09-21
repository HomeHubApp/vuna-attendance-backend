import { Resend } from "resend";

const FROM_NAME = process.env.RESEND_FROM_NAME || "Veritas Attendance System";

// This is for creating the Resend client lazily on first send, so a missing RESEND_API_KEY
// fails at send time with a clear message instead of crashing the whole server on startup
let resendClient = null;
function getResend() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("Failed to send email: RESEND_API_KEY is not set");
    }
    if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
}

// This is for the one place every email actually gets sent from — the Resend SDK returns
// { data, error } instead of throwing on API errors, so a failure is converted into a thrown
// Error here to keep the same behaviour callers already relied on with Brevo
async function sendEmail({ to, subject, html }) {
    if (!process.env.RESEND_FROM_EMAIL) {
        throw new Error("Failed to send email: RESEND_FROM_EMAIL is not set");
    }

    const { data, error } = await getResend().emails.send({
        from: `${FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
        to,
        subject,
        html,
    });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
}

// This is for sending the OTP used for email verification and password reset
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

// This is for sending a new user their login ID and temporary password after an admin creates their account
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

// This is for telling a user their password was reset by an admin, with the new temporary password
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
