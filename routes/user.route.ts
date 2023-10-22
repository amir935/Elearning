import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import {
  activateUser,
  loginUser,
  registerUser,
  logoutUser,
  updateAccessToken,
  getUserInfo,
  socialAuth,
  updateUserInfo,
  updatePassword,
  updateProfilePicture,
  enrollCourse,
  getAllUsers,
  updateUserRole,
  deleteUser,
} from "../controllers/user.controller";

const userRouter = express.Router();

userRouter.post("/registration", registerUser);

userRouter.post("/activate-user", activateUser);

userRouter.post("/login", loginUser);

userRouter.get("/refreshtoken", updateAccessToken);

//,authorizeRoles("admin")

userRouter.get("/logout", isAuthenticated, logoutUser);

userRouter.get("/me", isAuthenticated, getUserInfo);

userRouter.post("/social-auth", socialAuth);

userRouter.put("/update-userInfo", isAuthenticated, updateUserInfo);

userRouter.put("/update-userPassword", isAuthenticated, updatePassword);

userRouter.put("/update-userAvatar", isAuthenticated, updateProfilePicture);

userRouter.put("/enroll/user/:userId/course/:courseId",isAuthenticated,  enrollCourse);

userRouter.put("/update-user-role",isAuthenticated,authorizeRoles("admin"),  updateUserRole);

userRouter.get("/get-All-users",isAuthenticated,authorizeRoles("admin"),getAllUsers );

userRouter.delete("/delete-user/:id",isAuthenticated,authorizeRoles("admin"),deleteUser );

module.exports = userRouter;
