/**
 * @file Generates the random temporary password an Admin-created account
 * starts with, from a character set that excludes visually-confusable
 * characters (no `0/O`, `1/I/l`).
 */
export function generateDefaultPassword(length = 10) {
    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        password += chars[randomIndex];
    }

    return password;
}