import { supabase } from "../config/supabase.js";

export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or malformed Authorization header" });
        }

        const token = authHeader.split(" ")[1];

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