import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./src/routes/authRoutes.js";

const PORT = process.env.PORT || 8000;
const app = express();

app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    credentials: true,
}));

app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));