import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(to, otp, purpose) {
    const subject = purpose === "EMAIL_VERIFICATION"
        ? "Verify your email — Veritas Attendance"
        : "Password reset code — Veritas Attendance";

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: {
                email: process.env.BREVO_FROM_EMAIL,
                name: process.env.BREVO_FROM_NAME,
            },
            to: [{ email: to }],
            subject,
            htmlContent: `
                <p>Your code is: <strong>${otp}</strong></p>
                <p>This code expires in 10 minutes.</p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            `,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
            `Failed to send email: ${errorBody.message || response.statusText}`
        );
    }
}