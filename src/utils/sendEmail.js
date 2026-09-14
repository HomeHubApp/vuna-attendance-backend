export async function sendOtpEmail(to, otp, purpose) {
    console.log("sendOtpEmail called with:", to, purpose); // temporary
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
    console.log("Brevo error response:", errorBody); // temporary — remove after debugging
    throw new Error(
        `Failed to send email: ${errorBody.message || response.statusText}`
    );
}
}

export async function sendWelcomeEmail(to, { full_name, institution_identifier, default_password }) {
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
            subject: "Welcome to Veritas Attendance System",
            htmlContent: `
                <p>Hi ${full_name},</p>
                <p>Your account has been created on the Veritas Attendance System.</p>
                <p><strong>Login ID:</strong> ${institution_identifier}</p>
                <p><strong>Temporary password:</strong> ${default_password}</p>
                <p>Please log in and change your password as soon as possible.</p>
                <p>If you weren't expecting this account, please contact your department administrator.</p>
            `,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`Failed to send email: ${errorBody.message || response.statusText}`);
    }
}

export async function sendPasswordRegeneratedEmail(to, { full_name, institution_identifier, new_password }) {
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
            subject: "Your password has been reset — Veritas Attendance System",
            htmlContent: `
                <p>Hi ${full_name},</p>
                <p>An administrator has reset your password on the Veritas Attendance System.</p>
                <p><strong>Login ID:</strong> ${institution_identifier}</p>
                <p><strong>New temporary password:</strong> ${new_password}</p>
                <p>Please log in and change your password as soon as possible.</p>
                <p>If you didn't expect this change, please contact your department administrator immediately.</p>
            `,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`Failed to send email: ${errorBody.message || response.statusText}`);
    }
}