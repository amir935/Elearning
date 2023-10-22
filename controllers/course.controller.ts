import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import courseModel from "../models/course.model";
require("dotenv").config();
import cloudinary from "cloudinary";
import { createCourse, getAllUCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { IUser } from "../models/user.model";
import NotificationModel from "../models/notificationModel";

export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      createCourse(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        await cloudinary.v2.uploader.destroy(thumbnail.public_id);
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      const courseId = req.params.id;
      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        {
          $set: data,
        },
        { new: true }
      );
      res.status(201).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const getSingleCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;

      const isCacheExist = await redis.get(courseId);
      if (isCacheExist) {
        const course = JSON.parse(isCacheExist);
        res.status(200).json({
          success: true,
          course,
        });
      }
      const course = await CourseModel.findById(req.params.id).select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
      );

      await redis.set(courseId,JSON.stringify(course), 'EX', 604800)
      if (!course) {
        throw new ErrorHandler("Course not found", 404);
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const getCoursesWithoutPurchase = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const course = await CourseModel.find().select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
      );

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get course countent for valid user
export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExist = userCourseList?.find(
        (course: any) => course._id.toString() === courseId
      );

      if (courseExist) {
        return next(
          new ErrorHandler("You are not eligibleto access this course", 404)
        );
      }

      const course = await CourseModel.findById(courseId);

      const content = course?.courseData;

      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add Question in Course

interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId }: IAddQuestionData = req.body;
      const course = await CourseModel.findById(courseId);

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content", 400));
      }

      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      courseContent.questions.push(newQuestion);

      await NotificationModel.create({
        userId: req.user?._id,
        title: "New Question Recieved",
        message: `You have a new question from ${courseContent.title}`,
    });
      await course?.save();
      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

interface IAddAnswernData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId }: IAddAnswernData =
        req.body;
      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content", 400));
      }
      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 400));
      }
      const question = courseContent?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );

      if (!question) {
        return next(new ErrorHandler("Invalid question id", 400));
      }

      const newAnswer: any = {
        user: req.user, // Include the user object
        answer,
      };

      question.questionReplies?.push(newAnswer);

      await course?.save();

      if (req.user?._id === question.user._id) {
        await NotificationModel.create({
          userId: req.user?._id,
          title: "New Order",
          message: `You have a new question reply in from ${courseContent.title}`,
      });
      } else {
        const data = {
          user: req.user, // Include the user object
          name: question.user.name,
          title: courseContent.title,
        };
        console.log("Data being passed to the template:", data);

        // Render the email template
        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );

        try {
          // Send the email using your sendMail function
          await sendMail({
            email: question.user.email,
            subject: "Question Reply",
            // Assuming "question-reply.ejs" is your email template
            template: "question-reply.ejs",
            data, // Include the data with the user's name and title
           // Pass the rendered HTML as the email content
          });

          console.log("Email sent successfully.");
        } catch (error) {
          // Handle email sending error appropriately
          return next(new ErrorHandler("Error sending email", 500));
        }
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

interface IAddReviewData {
  review: string;
  rating: number;
}

export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.courseId; // Get the course ID from the URL params

      // Log courseId for debugging
      console.log("courseId:", courseId);

      const user = req.user as IUser; // Assuming you have authentication middleware that provides the user object

      // Check if the user is already enrolled in the course
      const isEnrolled = user.courses.some((enrolledCourse : any) => enrolledCourse.courseId === courseId);

      if (!isEnrolled) {
        // Log an error message for debugging
        console.error("User is not eligible to access this course.");
        return next(new ErrorHandler("You are not eligible to access this course", 400));
      }

      const course = await CourseModel.findById(courseId); // Replace 'CourseModel' with your actual model

      if (!course) {
        // Log an error message for debugging
        console.error("Course not found.");
        return next(new ErrorHandler("Course not found", 404));
      }

      const { review, rating } = req.body as IAddReviewData;

      if (!review || !rating) {
        // Log an error message for debugging
        console.error("Invalid review data.");
        return next(new ErrorHandler("Invalid review data", 400));
      }

      const reviewData: any = {
        user: req.user,
        comment: review,
        rating,
      };

      course.reviews.push(reviewData);

      let avg = 0;

      course.reviews.forEach((rev: any) => {
        avg += rev.rating;
      });

      course.ratings = avg / course.reviews.length;

      await course.save();

      // Add code to send notifications here (e.g., using a notification service).

      // Log a success message for debugging
      console.log("Review added successfully.");

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      // Log the error message for debugging
      console.error("Error:", error.message);
      next(new ErrorHandler(error.message, 500));
    }
  }
);

interface IAddReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}
export const addReplyToReview = CatchAsyncError(async(req:Request,res:Response,next:NextFunction)=>{
  try {
    const {comment, courseId,reviewId} = req.body as IAddReviewData;
    
    const course = await CourseModel.findById(courseId);

    if(!course){
      return next(new ErrorHandler("Course not found", 404));
    };

    const review = course?.reviews?.find((rev:any)=>rev._id.toString()=== reviewId);

    if(!review){
      return next(new ErrorHandler("Review not found", 404));
    };

    const replyData:any ={
      user: req.user,
      comment
    };

    if(!review.commentReplies){
      review.commentReplies = [];
    }

   review.commentReplies?.push(replyData);

    await course?.save();

    res.status(200).json({
      success: true,
      course,
    });



  } catch (error:any) {
    next(new ErrorHandler(error.message, 500));
  }
});

export const getAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction)=>{
    try {
      getAllUCoursesService(res);
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400)); 
    }
  }
);

export const deleteCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction)=>{
    try {
      const {id} = req.params;

      const course  = await courseModel.findById(id);

      if(!course){
        return next(new ErrorHandler("Course not found", 400));
      }

      await course.deleteOne({id});

      await redis.del(id);
      res.status(200).json({
        success: true,
        message: "Course deleted sucessfully"
      })
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400)); 
    }
  }
);