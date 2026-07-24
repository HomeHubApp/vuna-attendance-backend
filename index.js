import 'dotenv/config';
import express from "express";
import authRoutes from "./src/routes/authRoutes.js";
import cors from "cors";



const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());

app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
}));

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));