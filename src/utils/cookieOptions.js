function baseCookieOptions() {
    return {
        httpOnly: true,
        secure: true,
        sameSite: "none",
    };
}

export function accessTokenCookieOptions() {
    return {
        ...baseCookieOptions(),
        maxAge: 60 * 60 * 1000,
        path: "/",
    };
}

export function refreshTokenCookieOptions() {
    return {
        ...baseCookieOptions(),
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/api/auth",
    };
}

export function clearAccessTokenCookieOptions() {
    return { ...baseCookieOptions(), path: "/" };
}

export function clearRefreshTokenCookieOptions() {
    return { ...baseCookieOptions(), path: "/api/auth" };
}
