import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import Jwt, { JwtPayload, Secret } from "jsonwebtoken";
require("dotenv").config();
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import cloudinary from "cloudinary";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import CourseModel from "../models/course.model";

//register user
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}
export const registerUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email already exist", 400));
      }
      const user: IRegistrationBody = {
        name,
        email,
        password,
      };
      const activationToken = createActivationToken(user);

      const activationCode = activationToken.activationCode;

      const data = { user: { name: user.name }, activationCode };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );

      try {
        await sendMail({
          email: user.email,
          subject: "Activation your account",
          template: "activation-mail.ejs",
          data,
        });
        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.email} to activate the account`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IActivation {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivation => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const token = Jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );

  return { token, activationCode };
};

//user activation

interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;
      const newUser: { user: IUser; activationCode: string } = Jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode != activation_code) {
        return next(new ErrorHandler("Invalide activation code", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler("Email already exist", 400));
      }
      const user = await userModel.create({
        name,
        email,
        password,
      });
      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    //

    try {
      const { email, password } = req.body as ILoginRequest;

      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }
      // const user1 = await userModel.findOne({ email });
      const user = await userModel.findOne({ email }).select("+password");

      console.log("Fetched User:", user);

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      if (!user.comparePassword) {
        return next(new ErrorHandler("Error in user data", 500));
      }

      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }
      //return res.status(200).json({ success: true, message: "No operations performed." });
      return sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// logout user

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });
      const userId = req.user?._id || "";
      redis.del(userId);
      res.status(200).json({
        sucess: true,
        message: "Logged out sucessfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;
      const decoded = Jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      const message = "Could not refresh token";
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }
      const session = await redis.get(decoded.id as string);
      if (!session) {
        return next(new ErrorHandler("Please login to access this Resources", 400));
      }

      const user = JSON.parse(session);
      const accessToken = Jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn: "5m",
        }
      );

      const refreshToken = Jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn: "3d",
        }
      );

      req.user = user;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions); // Fix the cookie name here

      await redis.set(user._id, JSON.stringify(user), "EX", 604800); // 7 days
      res.status(200).json({
        status: "success",
        accessToken,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


//get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      getUserById(userId, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}
//social auth

export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IUpdateUserInfo {
  email?: string;
  name?: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name } = req.body as IUpdateUserInfo;
      const userId = req.user?._id;
      const user = await userModel.findById(userId);

      if (email && user) {
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist) {
          return next(new ErrorHandler("Email already exist", 400));
        }
        user.email = email;
      }
      if (name && user) {
        user.name = name;
      }

      await user?.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update user password
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;
      const user = await userModel.findById(req.user?._id).select("+password");

      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Please enter old and new password", 400));
      }

      if (user?.password === undefined) {
        return next(new ErrorHandler("Invalid user", 400));
      }

      const isPasswordMatch = await user?.comparePassword(oldPassword);

      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid Old password", 400));
      }

      user.password = newPassword;
      await user.save();

      await redis.set(req.user?._id, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IUpdateProfilePicture {
  avatar: string;
}
export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body as IUpdateProfilePicture;

      const userId = req?.user?._id;

      const user = await userModel.findById(userId);

      if (avatar && user) {
        //if user have one avatar
        if (user?.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
          const mycloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: mycloud.public_id,
            url: mycloud.secure_url,
          };
        } else {
          const mycloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: mycloud.public_id,
            url: mycloud.secure_url,
          };
        }
      }
      await user?.save();

      await redis.set(req.user?._id, JSON.stringify(user));

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const enrollCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId; // Get the user ID from the URL params
      const courseId = req.params.courseId; // Get the course ID from the URL params

      // Log userId and courseId for debugging
      console.log("userId:", userId);
      console.log("courseId:", courseId);

      const user = req.user as IUser; // Assuming you have authentication middleware that provides the user object

      // Check if the user is already enrolled in the course
      let isEnrolled = false;
      for (const enrolledCourse of user.courses) {
        if (enrolledCourse.courseId === courseId) {
          isEnrolled = true;
          break;
        }
      }

      if (isEnrolled) {
        // Log an error message for debugging
        console.error("User is already enrolled in this course.");
        return next(new ErrorHandler("You are already enrolled in this course", 400));
      }

      // Find the course by courseId using your course model
      const course = await CourseModel.findById(courseId); // Replace 'courseModel' with your actual model

      if (!course) {
        // Log an error message for debugging
        console.error("Course not found.");
        return next(new ErrorHandler("Course not found", 404));
      }

      // Enroll the user in the course
      user.courses.push({ courseId }); // Push an object with courseId property
      await user.save();

      // Log a success message for debugging
      console.log("Enrollment successful.");

      res.status(200).json({
        success: true,
        message: "Enrolled in the course successfully",
      });
    } catch (error: any) {
      // Log the error message for debugging
      console.error("Error:", error.message);
      next(new ErrorHandler(error.message, 500));
    }
  }
);


//get all users -- only for admin

export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction)=>{
    try {
      getAllUsersService(res);
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400)); 
    }
  }
);


//update user role --- only for admin

export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction)=>{
    try {
      const {id, role} = req.body;
      updateUserRoleService(res,id, role);
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400)); 
    }
  }
);

export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction)=>{
    try {
      const {id} = req.params;

      const user  = await userModel.findById(id);

      if(!user){
        return next(new ErrorHandler("User not found", 400));
      }

      await user.deleteOne({id});

      await redis.del(id);
      res.status(200).json({
        success: true,
        message: "User deleted sucessfully"
      })
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400)); 
    }
  }
);