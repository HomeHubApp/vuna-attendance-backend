import { supabaseAdmin } from "../config/supabase.js";
// Handles all admin operations

export async function getAllUsers({ role, search, page = 1, limit = 20 } = {}) {
    const { data: usersData, error } = await supabaseAdmin
        .from("users")
        .select(`
            id, institution_identifier, full_name, email, email_verified_at,
            is_default_password, status, last_login_at, created_at, updated_at,
            user_roles!user_roles_user_id_fkey ( scope_type, scope_id, roles ( name ) )
        `);

    if (error) {
        const err = new Error(error.message);
        err.statusCode = 500;
        throw err;
    }

    const { data: studentsData } = await supabaseAdmin
        .from("students").select("user_id, current_level, departments(name)");
    const { data: staffData } = await supabaseAdmin
        .from("staff").select("user_id, employment_type, office, departments(name)");

    const studentMap = new Map((studentsData || []).map((s) => [s.user_id, s]));
    const staffMap = new Map((staffData || []).map((s) => [s.user_id, s]));

    let shaped = usersData.map((u) => {
        const roles = (u.user_roles || []).map((r) => ({
            role: r.roles.name, scope_type: r.scope_type, scope_id: r.scope_id,
        }));
        const studentInfo = studentMap.get(u.id);
        const staffInfo = staffMap.get(u.id);
        const detail = studentInfo?.current_level
            ? `${studentInfo.current_level} Level`
            : staffInfo?.employment_type || null;

        return {
            id: u.id,
            name: u.full_name,
            institution_identifier: u.institution_identifier,
            email: u.email,
            department: studentInfo?.departments?.name || staffInfo?.departments?.name || null,
            detail,
            status: u.status,
            roles,
            email_verified: Boolean(u.email_verified_at),
            is_default_password: u.is_default_password,
            last_login_at: u.last_login_at,
            created_at: u.created_at,
        };
    });

    const counts = {
        Student: shaped.filter((u) => u.roles.some((r) => r.role === "Student")).length,
        Lecturer: shaped.filter((u) => u.roles.some((r) => r.role === "Lecturer")).length,
        Monitor: shaped.filter((u) => u.roles.some((r) => r.role === "Monitor")).length,
        Admin: shaped.filter((u) => u.roles.some((r) => r.role === "Admin")).length,
    };

    if (role) {
        shaped = shaped.filter((u) => u.roles.some((r) => r.role === role));
    }

    if (search) {
        const term = search.toLowerCase();
        shaped = shaped.filter((u) =>
            u.name?.toLowerCase().includes(term) ||
            u.institution_identifier?.toLowerCase().includes(term) ||
            u.email?.toLowerCase().includes(term)
        );
    }

    const total = shaped.length;
    const startIndex = (page - 1) * limit;
    const paginated = shaped.slice(startIndex, startIndex + limit);

    return {
        users: paginated,
        counts,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// Helper function to shape a single user for responses
async function shapeUser(userId) {
    const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select(`
            id, institution_identifier, full_name, email, email_verified_at,
            is_default_password, status, last_login_at, created_at, updated_at,
            user_roles!user_roles_user_id_fkey ( scope_type, scope_id, roles ( name ) )
        `)
        .eq("id", userId)
        .single();

    if (userError) {
        if (userError.code === "PGRST116") { // Not found
            return null;
        }
        const err = new Error(userError.message);
        err.statusCode = 500;
        throw err;
    }

    const { data: studentData } = await supabaseAdmin
        .from("students")
        .select("user_id, current_level, departments(name)")
        .eq("user_id", userId)
        .single();

    const { data: staffData } = await supabaseAdmin
        .from("staff")
        .select("user_id, employment_type, office, departments(name)")
        .eq("user_id", userId)
        .single();

    const roles = (userData.user_roles || []).map((r) => ({
        role: r.roles.name,
        scope_type: r.scope_type,
        scope_id: r.scope_id,
    }));

    const detail = studentData?.current_level
        ? `${studentData.current_level} Level`
        : staffData?.employment_type || null;

    return {
        id: userData.id,
        name: userData.full_name,
        institution_identifier: userData.institution_identifier,
        email: userData.email,
        department: studentData?.departments?.name || staffData?.departments?.name || null,
        detail,
        status: userData.status,
        roles,
        email_verified: Boolean(userData.email_verified_at),
        is_default_password: userData.is_default_password,
        last_login_at: userData.last_login_at,
        created_at: userData.created_at,
    };
}

export async function updateUser(userId, updates) {
    if (!userId) {
        const err = new Error("User ID is required");
        err.statusCode = 400;
        throw err;
    }

    // Filter out null/undefined and role (which is not allowed to update via this endpoint)
    const updatePayload = {};
    if (updates.full_name !== undefined) updatePayload.full_name = updates.full_name;
    if (updates.institution_identifier !== undefined) updatePayload.institution_identifier = updates.institution_identifier;
    if (updates.email !== undefined) updatePayload.email = updates.email;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    // Note: department_id updates are handled via students/staff tables, not directly here
    // For now, we skip department_id as it requires joining to student/staff records

    if (Object.keys(updatePayload).length === 0) {
        const err = new Error("No valid fields provided to update");
        err.statusCode = 400;
        throw err;
    }

    // Update the users table
    const { error: updateError } = await supabaseAdmin
        .from("users")
        .update(updatePayload)
        .eq("id", userId);

    if (updateError) {
        const err = new Error(updateError.message);
        err.statusCode = 500;
        throw err;
    }

    // Handle department_id update if provided
    if (updates.department_id !== undefined) {
        // Update students table if user is a student
        await supabaseAdmin
            .from("students")
            .update({ department_id: updates.department_id })
            .eq("user_id", userId);

        // Update staff table if user is staff
        await supabaseAdmin
            .from("staff")
            .update({ department_id: updates.department_id })
            .eq("user_id", userId);
    }

    // Fetch and return the updated user
    const updatedUser = await shapeUser(userId);
    if (!updatedUser) {
        const err = new Error("User not found after update");
        err.statusCode = 404;
        throw err;
    }

    return updatedUser;
}

export async function deleteUser(userId) {
    if (!userId) {
        const err = new Error("User ID is required");
        err.statusCode = 400;
        throw err;
    }

    // Fetch the user before deletion (to return it in response)
    const userBeforeDelete = await shapeUser(userId);
    if (!userBeforeDelete) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    // Attempt to delete the user
    const { error: deleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

    if (deleteError) {
        // Check if it's a FK constraint error
        if (deleteError.code === "23503") {
            const err = new Error(
                "Cannot delete user: user has related records (e.g., attendance, course assignments). Consider marking as SUSPENDED instead."
            );
            err.statusCode = 400;
            throw err;
        }
        const err = new Error(deleteError.message);
        err.statusCode = 500;
        throw err;
    }

    return userBeforeDelete;
}