import dotenv from "dotenv"
dotenv.config();


export const config = {
	PORT: process.env.PORT || 3004,
	HOST: "127.0.0.1",
	DB_PATH_USER: "./src/db/user.db.json",
	DB_PATH_TASK: "./src/db/task.db.json",
	MONGODB_URI: process.env.MONGODB_URI,
	SECRET_KEY: "encriptado-@",
	JWT_CONFIG:{
		expiresIn: 1*60
	}
};
