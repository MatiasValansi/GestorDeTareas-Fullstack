import { Router } from "express";
import { UserController } from "../controller/user.controller.js";
import { authByToken } from "../middleware/auth.jwt.js";

const userRouter = Router();

userRouter.get("/user/:id", authByToken, UserController.userValidation);
userRouter.get("/allUsers", authByToken, UserController.userAll); //GetAll
userRouter.post("/user", authByToken, UserController.userCreateOne);
userRouter.put("/user/:id", authByToken, UserController.userUpdateOne);
userRouter.delete("/user/:id", authByToken, UserController.userDeleteOne);
//userRouter.delete("/allUsers", (req, res) => {}); //DeleteAll

export { userRouter };
