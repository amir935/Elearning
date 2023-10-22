import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import { getCourseAnalyitics, getOrderAnalyitics, getUserAnalyitics } from "../controllers/analytics.controller";


const analyticRouter = express.Router();


analyticRouter.get(
    "/get-user-analytic",
    isAuthenticated,
    authorizeRoles("admin"),
    getUserAnalyitics
  );

  analyticRouter.get(
    "/get-course-analytic",
    isAuthenticated,
    authorizeRoles("admin"),
    getCourseAnalyitics
  );

  analyticRouter.get(
    "/get-order-analytic",
    isAuthenticated,
    authorizeRoles("admin"),
    getOrderAnalyitics
  );



module.exports =  analyticRouter 