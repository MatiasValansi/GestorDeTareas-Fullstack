import dotenv from "dotenv";
dotenv.config();

export const config = {
	PORT: process.env.PORT || 3004,
	HOST: "127.0.0.1",
	DB_PATH_USER: "./src/db/user.db.json",
	DB_PATH_TASK: "./src/db/task.db.json",
	MONGODB_URI: process.env.MONGODB_URI,
	// Clave para firmar JWT: en producción debe venir de env
	SECRET_KEY: process.env.JWT_SECRET || "encriptado-@",
	// Tiempo de expiración de los tokens (por ejemplo "7d")
	JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
	JWT_CONFIG: {
		expiresIn: process.env.JWT_EXPIRES_IN || "7d",
	},
};
