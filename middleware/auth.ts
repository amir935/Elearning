import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "./catchAsyncError";
import Jwt, { JwtPayload } from "jsonwebtoken";

import { redis } from "../utils/redis";
require("dotenv").config();

export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.cookies.access_token as string;

    if (!access_token) {
      return next(
        new ErrorHandler("Please login to access this resource", 400)
      );
    }

    const decode = Jwt.verify(
      access_token,
      process.env.ACCESS_TOKEN as string
    ) as JwtPayload;

    console.log(decode);
    if (!decode) {
      return next(new ErrorHandler("access token is not valid", 400));
    }

    const user = await redis.get(decode.id);

    if (!user) {
      return next(new ErrorHandler("Please login to access this Resourse", 400));
    }

    req.user = JSON.parse(user);
    next();
  }
);

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(
        new ErrorHandler(
          `Role: ${req.user?.role} is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};
