import { Router } from "express";
import { RecurringTaskController } from "../controller/recurring.task.controller.js";
import { authByToken } from "../middleware/auth.jwt.js";
import { requireSupervisor } from "../middleware/authorization.js";

const recurringTaskRouter = Router();

// Todas las operaciones sobre tareas recurrentes requieren supervisor autenticado
recurringTaskRouter.post(
	"/recurring-tasks",
	authByToken,
	requireSupervisor,
	RecurringTaskController.create,
);

recurringTaskRouter.get(
	"/recurring-tasks",
	authByToken,
	requireSupervisor,
	RecurringTaskController.getAll,
);

recurringTaskRouter.get(
	"/recurring-tasks/:id",
	authByToken,
	requireSupervisor,
	RecurringTaskController.getById,
);

recurringTaskRouter.put(
	"/recurring-tasks/:id",
	authByToken,
	requireSupervisor,
	RecurringTaskController.update,
);

// Generar tareas individuales para un mes específico (endpoint principal para el calendario)
recurringTaskRouter.post(
	"/recurring-tasks/generate/:year/:month",
	authByToken,
	RecurringTaskController.generateTasksForMonth,
);

recurringTaskRouter.delete(
	"/recurring-tasks/:id",
	authByToken,
	requireSupervisor,
	RecurringTaskController.delete,
);

export { recurringTaskRouter };
