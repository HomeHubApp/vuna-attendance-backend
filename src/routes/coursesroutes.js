import rateLimit from "express-rate-limit";
import { createcourses,deleteCourseController,getcourses,updateCourse,getCourseById} from "../controllers/coursescontroller.js"
import express from "express";
const router = express.Router();


const courseCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: "Too many courses created from this IP, please try again later." },
  standardHeaders: true, 
  legacyHeaders: false,
});


router.post("/createcourses", courseCreationLimiter, createcourses);
router.get("/courses",getcourses)
router.delete("/courses/:id",deleteCourseController)
router.patch("/courses/:id",updateCourse)
router.get("/courses/:id",getCourseById)
export default router;
