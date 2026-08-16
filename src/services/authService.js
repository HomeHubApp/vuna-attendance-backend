import { supabase, supabaseAdmin } from "../config/supabase.js";
import { generateDefaultPassword } from "../utils/generatePassword.js";
import { validatePassword } from "../utils/validatePassword.js";
import { generateOtp, hashOtp, otpExpiry } from "../utils/otp.js";
import { sendOtpEmail } from "../utils/sendEmail.js";
import { ROLES, STAFF_ROLES, UNIVERSITY_DOMAIN } from "../constants/roles.js";

// Add this function to authService.js — everything else in that file is unchanged.

export async function refreshSession(refreshToken) {
    if (!refreshToken) {
        const err = new Error("No refresh token provided");
        err.statusCode = 401;
        throw err;
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data?.session) {
        const err = new Error("Invalid or expired refresh token");
        err.statusCode = 401;
        throw err;
    }

    return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
    };
}
export async function adminCreateUser({
    full_name,
    institution_identifier,
    email,
    role,
    department_id,
    scope_type,
}) {
    const name = full_name?.trim();
    const identifier = institution_identifier?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
 
    if (!name || !identifier || !role) {
        const err = new Error("full_name, institution_identifier, and role are required");
        err.statusCode = 400;
        throw err;
    }
 
    if ((role === ROLES.STUDENT || role === ROLES.LECTURER) && !department_id) {
        const err = new Error(`department_id is required for role: ${role}`);
        err.statusCode = 400;
        throw err;
    }

    if (STAFF_ROLES.includes(role)) {
        if (!normalizedEmail) {
            const err = new Error("A university email is required for staff accounts.");
            err.statusCode = 400;
            throw err;
        }
 
        if (!normalizedEmail.endsWith(UNIVERSITY_DOMAIN)) {
            const err = new Error(`Staff email must end with ${UNIVERSITY_DOMAIN}`);
            err.statusCode = 400;
            throw err;
        }
    }
 
    const DEFAULT_PASSWORD = generateDefaultPassword();
 
   
    const authEmail = STAFF_ROLES.includes(role)
        ? normalizedEmail
        : normalizedEmail || `${identifier}@pending.local`;
 
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
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
            email: normalizedEmail || null,
            is_default_password: true,
            status: "PENDING",
        });
 
    if (insertError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        const err = new Error(insertError.message);
        err.statusCode = 500;
        throw err;
    }
 
    const { data: roleRow, error: roleError } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", role)
        .single();
 
    if (roleError || !roleRow) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        const err = new Error(`Invalid role: ${role}`);
        err.statusCode = 400;
        throw err;
    }
 
    const { error: roleAssignError } = await supabaseAdmin
        .from("user_roles")
        .insert({
            user_id: data.user.id,
            role_id: roleRow.id,
            scope_type: role === ROLES.MONITOR ? scope_type : null,
            scope_id: role === ROLES.MONITOR ? department_id : null,
        });
 
    if (roleAssignError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        const err = new Error(roleAssignError.message);
        err.statusCode = 500;
        throw err;
    }
 
    if (role === ROLES.STUDENT) {
        const { error: extError } = await supabaseAdmin
            .from("students")
            .insert({ user_id: data.user.id, department_id });
 
        if (extError) {
            await supabaseAdmin.auth.admin.deleteUser(data.user.id);
            const err = new Error(extError.message);
            err.statusCode = 500;
            throw err;
        }
    } else if (role === ROLES.LECTURER) {
        const { error: extError } = await supabaseAdmin
            .from("staff")
            .insert({ user_id: data.user.id, department_id });
 
        if (extError) {
            await supabaseAdmin.auth.admin.deleteUser(data.user.id);
            const err = new Error(extError.message);
            err.statusCode = 500;
            throw err;
        }
    }
 
    return {
        id: data.user.id,
        institution_identifier: identifier,
        full_name: name,
        email: normalizedEmail || null,
        role,
        default_password: DEFAULT_PASSWORD,
    };
}
async function getUserRoleNames(userId) {
    const { data, error } = await supabaseAdmin
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", userId);

    if (error || !data) return [];

    return data.map((row) => row.roles.name);
}
export async function login({ institution_identifier, password }) {
    const identifier = institution_identifier?.trim();

    if (!identifier || !password) {
        const err = new Error("institution_identifier and password are required");
        err.statusCode = 400;
        throw err;
    }

    const isEmail = identifier.includes("@");

    let query = supabaseAdmin
        .from("users")
        .select("id, institution_identifier, email, full_name, is_default_password, status");

    query = isEmail
        ? query.eq("email", identifier.toLowerCase())
        : query.eq("institution_identifier", identifier);

    const { data: user, error: lookupError } = await query.single();

    if (lookupError || !user) {
        const err = new Error("Invalid login credentials");
        err.statusCode = 401;
        throw err;
    }

    const { data: roleRows, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("scope_type, scope_id, roles(name)")
        .eq("user_id", user.id);

    if (roleError) {
        const err = new Error(roleError.message);
        err.statusCode = 500;
        throw err;
    }

    const roles = (roleRows || []).map((row) => ({
        role: row.roles.name,
        scope_type: row.scope_type,
        scope_id: row.scope_id,
    }));

    const roleNames = roles.map((r) => r.role);
    const isStaffAccount = roleNames.some((name) => STAFF_ROLES.includes(name));
    const isStudentAccount = roleNames.includes(ROLES.STUDENT);

    if (isEmail && !isStaffAccount) {
        const err = new Error("Students must sign in with their matric number, not email.");
        err.statusCode = 401;
        throw err;
    }

    if (!isEmail && !isStudentAccount) {
        const err = new Error("Staff must sign in with their Veritas email.");
        err.statusCode = 401;
        throw err;
    }

    const authEmail = user.email || `${identifier}@pending.local`;

    const { data: session, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
    });
    

    if (authError) {
        const err = new Error("Invalid login credentials");
        err.statusCode = 401;
        throw err;
    }

    return {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        user: {
            id: user.id,
            full_name: user.full_name,
            institution_identifier: user.institution_identifier,
            status: user.status,
            roles,
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

    const { data: roleRows, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("scope_type, scope_id, roles(name)")
        .eq("user_id", authUserId);

    if (roleError) {
        const err = new Error(roleError.message);
        err.statusCode = 500;
        throw err;
    }

    const roles = (roleRows || []).map((row) => ({
        role: row.roles.name,
        scope_type: row.scope_type,
        scope_id: row.scope_id,
    }));

    return { ...profile, roles };
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

    // invalidate any previous unused OTPs for this purpose
    await supabaseAdmin
        .from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", authUserId)
        .eq("purpose", "EMAIL_VERIFICATION")
        .is("used_at", null);

    const otp = generateOtp();

    const { data: insertedOtp, error: insertError } = await supabaseAdmin
        .from("otp_codes")
        .insert({
            user_id: authUserId,
            code: hashOtp(otp),
            purpose: "EMAIL_VERIFICATION",
            expires_at: otpExpiry(10),
        })
        .select()
        .single();

    if (insertError) {
        const err = new Error(insertError.message);
        err.statusCode = 500;
        throw err;
    }

    try {
        await sendOtpEmail(user.email, otp, "EMAIL_VERIFICATION");
    } catch (emailError) {
        await supabaseAdmin.from("otp_codes").delete().eq("id", insertedOtp.id);
        const err = new Error("Failed to send verification email. Please try again.");
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

    return { user_id: userId, default_password: newPassword };
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

    if (userLookupError || !currentUser) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    if (currentUser.email_verified_at) {
        const err = new Error("Email is already verified.");
        err.statusCode = 400;
        throw err;
    }

    const hashedSubmitted = hashOtp(submittedOtp);

    const { data: otpRecord, error: lookupError } = await supabaseAdmin
        .from("otp_codes")
        .select("id, code, expires_at, used_at", "attempts")
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
    if (otpRecord.attempts >= process.env.MAX_OTP_ATTEMPTS) {
        await supabaseAdmin
            .from("otp_codes")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpRecord.id);

        const err = new Error("Too many incorrect attempts. Please request a new OTP.");
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

    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email: currentUser.email,
        email_confirm: true,
    });

    const {data: statusCheck} = await supabaseAdmin
        .from("users")
        .select("is_default_password")
        .eq("id", authUserId)
        .single();
    
    const onboardingComplete = statusCheck?.is_default_password === false;

    const {error : updateError} = await supabaseAdmin
        .from("users")
        .update({ 
            email_verified_at: new Date().toISOString(),
            status: onboardingComplete ? "ACTIVE" : "PENDING"
        })
        .eq("id", authUserId);

    if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
    }

    return { message: "Email verified successfully." };
}

export async function forgotPassword({ institution_identifier }) {
    const identifier = institution_identifier?.trim();
    const genericResponse = { message: "If this account exists, a reset code has been sent." };

    if (!identifier) {
        const err = new Error("institution_identifier is required");
        err.statusCode = 400;
        throw err;
    }

    const isEmail = identifier.includes("@");

    let query = supabaseAdmin
        .from("users")
        .select("id, email, email_verified_at");

    query = isEmail
        ? query.eq("email", identifier.toLowerCase())
        : query.eq("institution_identifier", identifier);

    const { data: user, error: lookupError } = await query.single();

    if (lookupError || !user || !user.email || !user.email_verified_at) {
        return genericResponse;
    }

    await supabaseAdmin
        .from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("purpose", "PASSWORD_RESET")
        .is("used_at", null);

    const otp = generateOtp();

    const { data: insertedOtp, error: insertError } = await supabaseAdmin
        .from("otp_codes")
        .insert({
            user_id: user.id,
            code: hashOtp(otp),
            purpose: "PASSWORD_RESET",
            expires_at: otpExpiry(10),
        })
        .select()
        .single();

    if (insertError) {
        const err = new Error(insertError.message);
        err.statusCode = 500;
        throw err;
    }

    try {
        await sendOtpEmail(user.email, otp, "PASSWORD_RESET");
    } catch (emailError) {
        await supabaseAdmin.from("otp_codes").delete().eq("id", insertedOtp.id);
        const err = new Error("Failed to send reset code. Please try again.");
        err.statusCode = 500;
        throw err;
    }

    const response = { ...genericResponse };

    if (process.env.NODE_ENV === "development") {
        response.otp = otp;
    }

    return response;
}

async function findValidResetOtp(userId, submittedOtp) {
    const hashedSubmitted = hashOtp(submittedOtp);

    const { data: otpRecord, error: lookupError } = await supabaseAdmin
        .from("otp_codes")
        .select("id, code, expires_at, used_at, attempts")
        .eq("user_id", userId)
        .eq("purpose", "PASSWORD_RESET")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (lookupError || !otpRecord) {
        const err = new Error("No reset code found. Please request a new one.");
        err.statusCode = 400;
        throw err;
    }

    if (otpRecord.used_at) {
        const err = new Error("This reset code has already been used.");
        err.statusCode = 400;
        throw err;
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
        const err = new Error("This reset code has expired. Please request a new one.");
        err.statusCode = 400;
        throw err;
    }

    if (otpRecord.attempts >= process.env.MAX_OTP_ATTEMPTS) {
        await supabaseAdmin
            .from("otp_codes")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpRecord.id);

        const err = new Error("Maximum OTP attempts exceeded. Please request a new code.");
        err.statusCode = 400;
        throw err;
    }

    if (otpRecord.code !== hashedSubmitted) {
        await supabaseAdmin
            .from("otp_codes")
            .update({ attempts: otpRecord.attempts + 1 })
            .eq("id", otpRecord.id);

        const err = new Error("Incorrect reset code.");
        err.statusCode = 400;
        throw err;
    }

    return otpRecord;
}

export async function verifyResetOtp({ institution_identifier, otp }) {
    const identifier = institution_identifier?.trim();

    if (!identifier || !otp) {
        const err = new Error("institution_identifier and otp are required");
        err.statusCode = 400;
        throw err;
    }

    const isEmail = identifier.includes("@");

    let query = supabaseAdmin.from("users").select("id");

    query = isEmail
        ? query.eq("email", identifier.toLowerCase())
        : query.eq("institution_identifier", identifier);

    const { data: user, error: lookupError } = await query.single();

    if (lookupError || !user) {
        const err = new Error("Incorrect reset code.");
        err.statusCode = 400;
        throw err;
    }

    await findValidResetOtp(user.id, otp);

    return { message: "Code verified. You may now reset your password." };
}

export async function resetPassword({ institution_identifier, otp, newPassword }) {
    const identifier = institution_identifier?.trim();

    if (!identifier || !otp) {
        const err = new Error("institution_identifier and otp are required");
        err.statusCode = 400;
        throw err;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
        const err = new Error(validationError);
        err.statusCode = 400;
        throw err;
    }

    const isEmail = identifier.includes("@");

    let query = supabaseAdmin.from("users").select("id");

    query = isEmail
        ? query.eq("email", identifier.toLowerCase())
        : query.eq("institution_identifier", identifier);

    const { data: user, error: lookupError } = await query.single();

    if (lookupError || !user) {
        const err = new Error("Incorrect reset code.");
        err.statusCode = 400;
        throw err;
    }

    const otpRecord = await findValidResetOtp(user.id, otp);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    );

    if (authError) {
        const err = new Error(authError.message);
        err.statusCode = 500;
        throw err;
    }

    await supabaseAdmin
        .from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", otpRecord.id);

    const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
            is_default_password: false,
            last_login_at: new Date().toISOString(),
        })
        .eq("id", user.id);

    if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
    }

    return { message: "Password reset successfully. You can now log in." };
}