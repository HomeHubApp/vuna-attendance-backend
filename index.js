import 'dotenv/config';
import express from "express";
import authRoutes from "./src/routes/authRoutes.js";


const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));