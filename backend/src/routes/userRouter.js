import { Router } from "express";
import { UserController } from "../controller/user.controller.js";
import { authByToken } from "../middleware/auth.jwt.js";
import {
	requireSupervisor,
	requireSameSectorForUserParam,
} from "../middleware/authorization.js";

const userRouter = Router();

// Endpoint para obtener usuarios del mismo sector (accesible para cualquier usuario autenticado)
userRouter.get(
	"/sector",
	authByToken,
	UserController.usersBySector,
);

// Solo supervisores pueden operar sobre usuarios y siempre dentro de su sector
userRouter.get(
	"/user/:id",
	authByToken,
	requireSupervisor,
	requireSameSectorForUserParam,
	UserController.userValidation,
);
userRouter.get(
	"/allUsers",
	authByToken,
	requireSupervisor,
	UserController.userAll,
); //GetAll
userRouter.post(
	"/user",
	UserController.userCreateOne,
);
userRouter.put(
	"/user/:id",
	authByToken,
	requireSupervisor,
	requireSameSectorForUserParam,
	UserController.userUpdateOne,
);
userRouter.delete(
	"/user/:id",
	authByToken,
	requireSupervisor,
	requireSameSectorForUserParam,
	UserController.userDeleteOne,
);
//userRouter.delete("/allUsers", (req, res) => {}); //DeleteAll

export { userRouter };
