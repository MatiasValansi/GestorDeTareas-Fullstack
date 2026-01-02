import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

const { SECRET_KEY, JWT_CONFIG } = config;

// Genera un JWT para el usuario con expiración configurada
export const userToken = (payload) => {
	return jwt.sign(payload, SECRET_KEY, JWT_CONFIG);
};
