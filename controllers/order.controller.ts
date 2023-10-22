import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import OrderModel, { IOrder } from "../models/order.model";
import ErrorHandler from "../utils/ErrorHandler";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificationModel";
import { getAllOrdersService, newOrder } from "../services/order.service";

// Create order
export const createOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, payment_info } = req.body as IOrder;

        // Find the user by ID
        const user = await userModel.findById(req.user?._id);

        // Check if the user has already purchased the course
        const courseExistInUser = user?.courses.some((course: any) => course._id.toString() === courseId);

        if (courseExistInUser) {
            return next(new ErrorHandler("You have already purchased this course", 400));
        }

        // Find the course by ID
        const course = await CourseModel.findById(courseId);

        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        // Prepare data for the order
        const data: any = {
            courseId: course._id,
            userId: user?._id,
        };

        // Prepare data for email
        const mailData = {
            order: {
                _id: course._id.toString().slice(0, 6),
                name: course.name,
                price: course.price,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            },
        };

        // Render the email template
        const html = await ejs.renderFile(path.join(__dirname, '../mails/order-confirmation.ejs'), { order: mailData });

        try {
            // Send email confirmation
            if (user) {
                await sendMail({
                    email: user.email,
                    subject: "Order Confirmation",
                    template: "order-confirmation.ejs",
                    data: mailData,
                });
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }

        // Update the user's purchased courses
        user?.courses.push(course?._id);
        await user?.save();

        // Update the purchased count for the course
        if (course.purchased !== undefined) {
            course.purchased += 1;
        } else {
            course.purchased = 1;
        }

        await course.save();

        // Create a notification for the user
        await NotificationModel.create({
            userId: user?._id,
            title: "New Order",
            message: `You have a new order from ${course?.name}`,
        });

        // Call the newOrder function (assuming it's defined elsewhere)
        newOrder(data, res, next);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});




export const getAllOrders = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction)=>{
      try {
        getAllOrdersService(res);
      } catch (error:any) {
        return next(new ErrorHandler(error.message, 400)); 
      }
    }
  );
