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

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://gestordetareasapp.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman / Render

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false); // ❗ NO tirar Error
    },
    credentials: true,
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
