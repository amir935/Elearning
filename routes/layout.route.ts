import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import { createLayout, editLayout, getLayoutByType } from "../controllers/layout.controller";


const layoutRouter = express.Router();


layoutRouter.post(
    "/create-layout",
    isAuthenticated,
    authorizeRoles("admin"),
    createLayout
  );

  layoutRouter.put(
    "/update-layout",
    isAuthenticated,
    authorizeRoles("admin"),
    editLayout
  );

  layoutRouter.get(
    "/get-layout",
    isAuthenticated,
    authorizeRoles("admin"),
    getLayoutByType
  );


  module.exports = layoutRouter;