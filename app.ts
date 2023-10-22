import express, { NextFunction, Request, Response } from "express";
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";

import { ErrorMiddleware } from "./middleware/error";

const userRouter = require("./routes/user.route");
const courseRouter = require("./routes/course.route");

const orderRouter = require("./routes/order.route");

const notificationRoute = require("./routes/notification.route");

const analyticRoute = require("./routes/analytic.route");

const layoutRoute = require("./routes/layout.route")


require("dotenv").config();

//body parse
app.use(express.json({ limit: "50mb" }));

//cookie parser
app.use(cookieParser());

//cors=> cross origin resource sharing

app.use(
  cors({
    origin: process.env.ORIGIN,
  })
);

app.use("/api/v1", userRouter,courseRouter,orderRouter,notificationRoute,analyticRoute,layoutRoute);


//testing api

app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "Api is working",
  });
});

//unknown route
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;

  err.statusCode = 404;
  next(err);
});

app.use(ErrorMiddleware);
