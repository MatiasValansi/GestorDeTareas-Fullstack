import cors from "cors";
import express from "express";
import { config } from "./config/config.js";
import mongoConnectionInstance from "./database/mongoose.database.js";
import { statusRouter } from "./routes/statusRouter.js";
import { taskRouter } from "./routes/taskRouter.js";
import { userRouter } from "./routes/userRouter.js";
import { authRouter } from "./routes/authRouter.js";
import { recurringTaskRouter } from "./routes/recurringTaskRouter.js";
import { parseDateFields } from "./middleware/dateParser.js";

const app = express();

/* =========================
   CORS CONFIG (FIX DEFINITIVO)
========================= */

app.use(
  cors({
    origin: true,          // 🔑 refleja el Origin automáticamente
    credentials: true,     // si usás cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🔑 CLAVE ABSOLUTA: habilitar preflight global
app.options("*", cors());



/* =========================
   MIDDLEWARES
========================= */

app.use(express.json());

// Middleware para convertir fechas de Argentina a UTC automáticamente
app.use(parseDateFields);

/* =========================
   ROUTES
========================= */

app.get("/", async (req, res) => {
	return res.json({
		message: "API Gestor de Tareas funcionando correctamente 🚀",
	});
});

app.use("/api", statusRouter);
app.use("/auth", authRouter);
app.use("/tasks", taskRouter);
app.use("/users", userRouter);
app.use("/recurringTask", recurringTaskRouter);

export default app;
