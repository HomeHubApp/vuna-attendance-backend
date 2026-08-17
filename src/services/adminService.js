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