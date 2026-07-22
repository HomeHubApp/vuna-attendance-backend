import crypto from "crypto";

export function generateOtp(length = 6) {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
}

export function hashOtp(otp) {
    return crypto.createHash("sha256").update(otp).digest("hex");
}

export function otpExpiry(minutes = 10) {
    return new Date(Date.now() + minutes * 60 * 1000);
}