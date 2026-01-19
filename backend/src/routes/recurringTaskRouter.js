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

// Endpoint para obtener tareas recurrentes según el rol del usuario
// - Usuario normal: solo las que tiene asignadas
// - Supervisor: todas las de usuarios de su mismo sector
recurringTaskRouter.get(
	"/recurring-tasks/my-tasks",
	authByToken,
	RecurringTaskController.getMyTasks,
);

// Endpoint para obtener detalle de una tarea recurrente con validación de permisos
// - Usuario normal: solo si está asignado a la tarea
// - Supervisor: si hay algún usuario asignado de su mismo sector
recurringTaskRouter.get(
	"/recurring-tasks/detail/:id",
	authByToken,
	RecurringTaskController.getByIdForUser,
);

recurringTaskRouter.get(
	"/recurring-tasks/:id",
	authByToken,
	requireSupervisor,
	RecurringTaskController.getById,
);

// PUT para actualizar SOLO la lista de usuarios asignados (assignedTo)
// Solo el titular (posición 0 del assignedTo) puede editar, independientemente de si es Supervisor
recurringTaskRouter.put(
	"/recurring-tasks/:id",
	authByToken,
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

// PATCH para desactivar (cambio de estado, no eliminación)
// Solo el titular de la tarea (posición 0 del assignedTo) puede desactivar
recurringTaskRouter.patch(
	"/recurring-tasks/:id/deactivate",
	authByToken,
	RecurringTaskController.deactivate,
);


export { recurringTaskRouter };
