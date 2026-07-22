import { supabase, supabaseAdmin } from "../config/supabase.js";
import { generateDefaultPassword } from "../utils/generatePassword.js";
import { validatePassword } from "../utils/validatePassword.js";
import { generateOtp, hashOtp, otpExpiry } from "../utils/otp.js";

export async function adminCreateUser({ full_name, institution_identifier, email }) {
    const name = full_name?.trim();
    const identifier = institution_identifier?.trim();

    if (!name || !identifier) {
        const err = new Error("full_name and institution_identifier are required");
        err.statusCode = 400;
        throw err;
    }

    const DEFAULT_PASSWORD = generateDefaultPassword();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email || `${identifier}@pending.local`,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
    });

    if (error) {
        const err = new Error(error.message);
        err.statusCode = 400;
        throw err;
    }

    const { error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
            id: data.user.id,
            institution_identifier: identifier,
            full_name: name,
            email: email || null,
            is_default_password: true,
            status: "PENDING",
        });

    if (insertError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        const err = new Error(insertError.message);
        err.statusCode = 500;
        throw err;
    }

    return {
        id: data.user.id,
        institution_identifier: identifier,
        full_name: name,
        email: email || null,
        default_password: DEFAULT_PASSWORD,
    };
}

export async function login({ institution_identifier, password }) {
    const identifier = institution_identifier?.trim();

    if (!identifier || !password) {
        const err = new Error("institution_identifier and password are required");
        err.statusCode = 400;
        throw err;
    }

    const { data: user, error: lookupError } = await supabaseAdmin
        .from("users")
        .select("id, email, full_name, is_default_password, status")
        .eq("institution_identifier", identifier)
        .single();

    if (lookupError || !user) {
        const err = new Error("Invalid institution identifier or password");
        err.statusCode = 401;
        throw err;
    }

    const authEmail = user.email || `${identifier}@pending.local`;

    const { data: session, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
    });

    if (authError) {
        const err = new Error("Invalid institution identifier or password");
        err.statusCode = 401;
        throw err;
    }

    return {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        user: {
            id: user.id,
            full_name: user.full_name,
            institution_identifier: identifier,
            status: user.status,
        },
        force_password_change: user.is_default_password,
    };
}

export async function getCurrentUser(authUserId) {
    const { data: profile, error } = await supabaseAdmin
        .from("users")
        .select("id, institution_identifier, full_name, email, status, is_default_password, created_at")
        .eq("id", authUserId)
        .single();

    if (error || !profile) {
        const err = new Error("User profile not found");
        err.statusCode = 404;
        throw err;
    }

    return profile;
}

export async function addEmail(authUserId, email) {
    const trimmedEmail = email?.trim().toLowerCase();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        const err = new Error("A valid email address is required");
        err.statusCode = 400;
        throw err;
    }

    const { error } = await supabaseAdmin
        .from("users")
        .update({ email: trimmedEmail, email_verified_at: null })
        .eq("id", authUserId);

    if (error) {
        const err = new Error(error.message);
        err.statusCode = 500;
        throw err;
    }

    return { message: "Email saved. Please verify it to complete setup." };
}

export async function sendEmailVerificationOtp(authUserId) {
    const { data: user, error: lookupError } = await supabaseAdmin
        .from("users")
        .select("email, email_verified_at")
        .eq("id", authUserId)
        .single();

    if (lookupError || !user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    if (!user.email) {
        const err = new Error("No email on file. Add an email first.");
        err.statusCode = 400;
        throw err;
    }

    if (user.email_verified_at) {
        const err = new Error("Email is already verified.");
        err.statusCode = 400;
        throw err;
    }

    const otp = generateOtp();

    const { error: insertError } = await supabaseAdmin
        .from("otp_codes")
        .insert({
            user_id: authUserId,
            code: hashOtp(otp),
            purpose: "EMAIL_VERIFICATION",
            expires_at: otpExpiry(10),
        });

    if (insertError) {
        const err = new Error(insertError.message);
        err.statusCode = 500;
        throw err;
    }

    const response = { message: "OTP sent successfully." };

    if (process.env.NODE_ENV === "development") {
        response.otp = otp;
    }

    return response;
}

export async function changePassword(authUserId, newPassword) {
    const validationError = validatePassword(newPassword);

    if (validationError) {
        const err = new Error(validationError);
        err.statusCode = 400;
        throw err;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: newPassword }
    );

    if (authError) {
        const err = new Error(authError.message);
        err.statusCode = 500;
        throw err;
    }

    const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
            is_default_password: false,
            last_login_at: new Date().toISOString(),
        })
        .eq("id", authUserId);

    if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
    }

    return { message: "Password changed successfully" };
}

export async function regenerateDefaultPassword(userId) {
    if (!userId) {
        const err = new Error("userId is required");
        err.statusCode = 400;
        throw err;
    }

    const { data: existingUser, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("id, status")
        .eq("id", userId)
        .single();

    if (fetchError || !existingUser) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    const newPassword = generateDefaultPassword();

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
    );

    if (authError) {
        const err = new Error(authError.message);
        err.statusCode = 500;
        throw err;
    }

    const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ is_default_password: true })
        .eq("id", userId);

    if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
    }

    return { user_id: userId, password_generated: true };
}

export async function verifyEmailOtp(authUserId, submittedOtp) {
    if (!submittedOtp) {
        const err = new Error("OTP is required");
        err.statusCode = 400;
        throw err;
    }

    const { data: currentUser, error: userLookupError } = await supabaseAdmin
        .from("users")
        .select("email, email_verified_at")
        .eq("id", authUserId)
        .single();

    if (currentUser.email_verified_at) {
        const err = new Error("Email is already verified.");
        err.statusCode = 400;
        throw err;
    }

    const hashedSubmitted = hashOtp(submittedOtp);

    const { data: otpRecord, error: lookupError } = await supabaseAdmin
        .from("otp_codes")
        .select("id, code, expires_at, used_at")
        .eq("user_id", authUserId)
        .eq("purpose", "EMAIL_VERIFICATION")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (lookupError || !otpRecord) {
        const err = new Error("No OTP request found. Please request a new one.");
        err.statusCode = 400;
        throw err;
    }

    if (otpRecord.used_at) {
        const err = new Error("This OTP has already been used.");
        err.statusCode = 400;
        throw err;
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
        const err = new Error("This OTP has expired. Please request a new one.");
        err.statusCode = 400;
        throw err;
    }

    if (otpRecord.code !== hashedSubmitted) {
        const err = new Error("Incorrect OTP.");
        err.statusCode = 400;
        throw err;
    }

    await supabaseAdmin
        .from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", otpRecord.id);

    const { data: user } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", authUserId)
        .single();

    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email: user.email,
        email_confirm: true,
    });

    const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ email_verified_at: new Date().toISOString() })
        .eq("id", authUserId);

    if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
    }

    return { message: "Email verified successfully." };
}