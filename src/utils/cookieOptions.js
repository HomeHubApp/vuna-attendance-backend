export function accessTokenCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", 
        sameSite: "lax",
        maxAge: 60 * 60 * 1000, 
    };
}

export function refreshTokenCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
    };
}

export function clearCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    };
}