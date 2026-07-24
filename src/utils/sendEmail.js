import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(to, otp, purpose) {
    const subject = purpose === "EMAIL_VERIFICATION"
        ? "Verify your email — Veritas Attendance"
        : "Password reset code — Veritas Attendance";

    const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to,
        subject,
        html: `
            <p>Your code is: <strong>${otp}</strong></p>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `,
    });

    if (error) {
        throw new Error(`Failed to send email: ${error.message || "unknown error"}`);
    }
}