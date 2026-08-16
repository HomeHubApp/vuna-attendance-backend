import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./src/routes/authRoutes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/config/swagger.js";
<<<<<<< HEAD
import courseroutes from "./src/routes/coursesroutes.js";
import { requireAuth } from "./src/middleware/authMiddleware.js";
import departmentroutes from "./src/routes/departmentRoutes.js"
const PORT = process.env.PORT || 8000;
const app = express();

app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://main.d4h1jxr36mgwz.amplifyapp.com"
    ],
=======

const PORT = process.env.PORT || 8000;
const app = express();

app.set("trust proxy", 1); 

app.use(express.json());
app.use(cors({
    origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost",
    "capacitor://localhost",
    "https://main.d4h1jxr36mgwz.amplifyapp.com"
],
>>>>>>> 14930114090753505ed231429661c1797bde25b7
    credentials: true,
}));

app.use(cookieParser());

app.use("/api/auth", authRoutes);
<<<<<<< HEAD
app.use("/api/courses", courseroutes)
app.use("/api/department",departmentroutes)
=======
>>>>>>> 14930114090753505ed231429661c1797bde25b7

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));