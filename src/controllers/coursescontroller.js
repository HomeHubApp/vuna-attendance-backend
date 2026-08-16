
import Courses from "../services/courseservice.js"
export const createcourses=async(req,res)=>{
try{
    
    const create_course=await Courses.createcourses(req.body)

    return res.status(200).json({message:"course created successfully",data:create_course}) 
}
catch(err){
     console.log(err);
       const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
}


}

export const getcourses = async (req, res) => {
  try {
   
    const allCourses = await Courses.getAllCourses();

    return res.status(200).json({
      message: "Courses retrieved successfully",
      count: allCourses.length,
      data: allCourses
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    
    return res.status(status).json({ error: "failed to fetch courses" });
  }

};
export const deleteCourseController = async (req, res) => {
  try {
    
    const courseId = req.params.id; 
    
    const result = await Courses.deleteCourse(courseId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.deletedCourse,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;
     const course = await Courses.getCourseById(courseId);
return res.status(200).json({
      success: true,
      message: "Course retrieved successfully",
      data: course
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({ 
      success: false, 
      error: error.message || "Failed to fetch course" 
    });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const updates = req.body;
    
    const updatedCourse = await Courses.updateCourse(courseId, updates);

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.log(error.message);
    return res.status(status).json({ 
      success: false, 
      error: error.message || "Failed to update course" 
    });
  }
};
