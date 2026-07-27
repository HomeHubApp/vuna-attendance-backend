import * as authService from "../services/authService.js";
import {
    accessTokenCookieOptions,
    refreshTokenCookieOptions,
    clearCookieOptions,
} from "../utils/cookieOptions.js";

export async function adminCreateUser(req, res) {
    try {
        const user = await authService.adminCreateUser(req.body);
        return res.status(201).json({ message: "User created successfully.", user });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function login(req, res) {
    try {
        const result = await authService.login(req.body);

        res.cookie("access_token", result.access_token, accessTokenCookieOptions());
        res.cookie("refresh_token", result.refresh_token, refreshTokenCookieOptions());

        return res.status(200).json({
            user: result.user,
            force_password_change: result.force_password_change,
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function refresh(req, res) {
    try {
        const refreshToken = req.cookies?.refresh_token;
        const tokens = await authService.refreshSession(refreshToken);

        res.cookie("access_token", tokens.access_token, accessTokenCookieOptions());
        res.cookie("refresh_token", tokens.refresh_token, refreshTokenCookieOptions());

        return res.status(200).json({ message: "Session refreshed" });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function logout(req, res) {
    res.clearCookie("access_token", clearCookieOptions());
    res.clearCookie("refresh_token", clearCookieOptions());
    return res.status(200).json({ message: "Logged out successfully" });
}

export async function me(req, res) {
    try {
        const profile = await authService.getCurrentUser(req.authUser.id);
        return res.status(200).json({ user: profile });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function addEmail(req, res) {
    try {
        const { email } = req.body;
        const result = await authService.addEmail(req.authUser.id, email);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function sendEmailVerificationOtp(req, res) {
    try {
        const result = await authService.sendEmailVerificationOtp(req.authUser.id);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function verifyEmailOtp(req, res) {
    try {
        const { otp } = req.body || {};
        const result = await authService.verifyEmailOtp(req.authUser.id, otp);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function changePassword(req, res) {
    try {
        const { newPassword } = req.body;
        const result = await authService.changePassword(req.authUser.id, newPassword);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function regenerateDefaultPassword(req, res) {
    try {
        const { userId } = req.params;
        const result = await authService.regenerateDefaultPassword(userId);
        return res.status(200).json({
            message: "Default password regenerated successfully.",
            ...result,
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function forgotPassword(req, res) {
    try {
        const result = await authService.forgotPassword(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function verifyResetOtp(req, res) {
    try {
        const result = await authService.verifyResetOtp(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}

export async function resetPassword(req, res) {
    try {
        const result = await authService.resetPassword(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message });
    }
}