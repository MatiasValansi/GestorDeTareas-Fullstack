import cors from "cors";
import express from "express";
import { config } from "./config/config.js";
import mongoConnectionInstance from "./database/mongoose.database.js";
import { statusRouter } from "./routes/statusRouter.js";
import { taskRouter } from "./routes/taskRouter.js";
import { userRouter } from "./routes/userRouter.js";
import { authRouter } from "./routes/authRouter.js";

const app = express();

// Middleware CORS
app.use(
	cors({
		origin: "http://localhost:5173", // URL de tu frontend en dev
		credentials: true,
	}),
);

app.use(express.json());

app.get("/", async (req, res) => {
	return res.json({
		message: "API Gestor de Tareas funcionando correctamente 🚀",
	});
});

app.use("/api", statusRouter);
app.use("/auth", authRouter);
app.use("/tasks", taskRouter);
app.use("/users", userRouter);

export default app;
/*
const startServer = async () => {
	try {
		await mongoConnectionInstance.connect();
		app.listen(config.PORT, () => {
			console.log(
				`🫶🏻⚽🍕 Server is Running in http://${config.HOST}:${config.PORT} 😎🍔💪🏻`,
			);
		});
	} catch (e) {
		console.error("Server is not running properly.");
		console.error(e);
		console.log("URI:", config.MONGODB_URI);
	console.log("Tipo:", typeof config.MONGODB_URI);
	}
};

startServer();
*/
