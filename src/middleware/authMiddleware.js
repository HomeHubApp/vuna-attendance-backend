import { supabase } from "../config/supabase.js";

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