import { Router } from "express";
import { AuthController } from "../controller/auth.controller.js";
import { authByToken } from "../middleware/auth.jwt.js";

const authRouter = Router();

// Login
authRouter.post("/login", AuthController.login);

// Perfil del usuario autenticado
authRouter.get("/me", authByToken, AuthController.me);

export { authRouter };
