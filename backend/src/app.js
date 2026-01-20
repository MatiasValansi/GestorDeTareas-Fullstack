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
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, Render healthcheck)
      if (!origin) return callback(null, true);

      // Permitir localhost
      if (
        origin === "http://localhost:5173" ||
        origin === "http://127.0.0.1:5173"
      ) {
        return callback(null, true);
      }

      // Permitir cualquier dominio de Vercel
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      // Permitir dominio del backend (opcional)
      if (origin === "https://gestordetareasapp.onrender.com") {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);



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
