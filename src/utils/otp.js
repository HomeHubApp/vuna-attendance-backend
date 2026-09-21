import crypto from "crypto";

// This is for generating the OTP itself — each digit comes from crypto.randomInt (a cryptographically
// secure source), not Math.random, whose output can be predicted from earlier values.
export function generateOtp(length = 6) {
    let otp = "";
    for (let i = 0; i < length; i++) {
        otp += crypto.randomInt(0, 10);
    }
    return otp;
}

// This is for hashing an OTP before it is stored or compared. It uses HMAC-SHA256 with a server-side
// secret (OTP_HMAC_SECRET, kept in the environment, never in the database), so someone who can read
// the otp_codes table still can't recover a 6-digit code by hashing all 1,000,000 possibilities.
// It throws when the secret is missing instead of falling back to a plain, reversible hash.
export function hashOtp(otp) {
    const secret = process.env.OTP_HMAC_SECRET;
    if (!secret) {
        throw new Error("OTP_HMAC_SECRET is not set");
    }
    return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

export function otpExpiry(minutes = 10) {
    return new Date(Date.now() + minutes * 60 * 1000);
}