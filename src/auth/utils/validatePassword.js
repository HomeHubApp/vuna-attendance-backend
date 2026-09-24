/**
 * @file The password-strength rule enforced on every user-chosen password
 * (at least 8 characters, one uppercase, one lowercase, one digit).
 */
export function validatePassword(password) {
    if (!password || password.length < 8) {
        return "Password must be at least 8 characters.";
    }

    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(password)) {
        return "Password must contain at least one lowercase letter.";
    }

    if (!/\d/.test(password)) {
        return "Password must contain at least one number.";
    }

    return null;
}