import Enrollment from "../services/enrollmentService.js";

export const getEligibleCourses = async (req, res) => {
    try {
        const courses = await Enrollment.getEligibleCourses(req.authUser.id);
        return res.status(200).json({ data: courses });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch eligible courses" });
    }
};

export const enroll = async (req, res) => {
    try {
        const { course_id } = req.body;
        const enrollment = await Enrollment.enroll(course_id, req.authUser.id);
        return res.status(201).json({ message: "Enrolled successfully", data: enrollment });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to enroll" });
    }
};

export const getMyEnrollments = async (req, res) => {
    try {
        const enrollments = await Enrollment.getMyEnrollments(req.authUser.id);
        return res.status(200).json({ data: enrollments });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch enrollments" });
    }
};

//lecturer-only route
export const getCourseRoster = async (req, res) => {
    try {
        const { course_id } = req.params;
        const roster = await Enrollment.getCourseRoster(course_id, req.authUser.id);
        return res.status(200).json({ data: roster });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch course roster" });
    }
};