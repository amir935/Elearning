import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import {
  editCourse,
  getCoursesWithoutPurchase,
  getSingleCourse,
  uploadCourse,
  getCourseByUser,
  addQuestion,
  addAnswer,
  addReview,
  addReplyToReview,
  getAllCourses,
  deleteCourse,
  
} from "../controllers/course.controller";

const courseRouter = express.Router();

courseRouter.post(
  "/create-course",
  isAuthenticated,
  authorizeRoles("admin"),
  uploadCourse
);

courseRouter.put(
  "/edit-course/:id",
  isAuthenticated,
  authorizeRoles("admin"),
  editCourse
);

courseRouter.get("/get-course/:id", getSingleCourse);

courseRouter.get("/get-courses", getCoursesWithoutPurchase);

courseRouter.get("/get-course-content/:id",isAuthenticated,  getCourseByUser);

courseRouter.put("/add-question",isAuthenticated,  addQuestion);

courseRouter.put("/add-answer",isAuthenticated,  addAnswer);

courseRouter.post("/add-review/:courseId",isAuthenticated,  addReview);

courseRouter.post("/add-reply-review",isAuthenticated,authorizeRoles("admin"),  addReplyToReview);

courseRouter.get("/get-All-courses",isAuthenticated,authorizeRoles("admin"),getAllCourses );

courseRouter.delete("/delete-course/:id",isAuthenticated,authorizeRoles("admin"),deleteCourse );



module.exports = courseRouter;
