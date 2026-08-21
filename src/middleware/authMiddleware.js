import { supabase } from "../config/supabase.js";
import { supabaseAdmin } from "../config/supabase.js";

export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.access_token;

        if (!token) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        req.authUser = data.user;
        req.token = token;
        next();
    } catch (error) {
        return res.status(500).json({ error: "Authentication failed." });
    }
}

export function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        try {
            const { data, error } = await supabaseAdmin
                .from("user_roles")
                .select("roles(name)")
                .eq("user_id", req.authUser.id);

            if (error) {
                return res.status(500).json({ error: "Could not verify role" });
            }

            const roleNames = (data || []).map((row) => row.roles.name);
            const hasAccess = roleNames.some((name) => allowedRoles.includes(name));

            if (!hasAccess) {
                return res.status(403).json({ error: "You do not have permission to perform this action" });
            }

            next();
        } catch (error) {
            return res.status(500).json({ error: "Authorization check failed" });
        }
    };
}