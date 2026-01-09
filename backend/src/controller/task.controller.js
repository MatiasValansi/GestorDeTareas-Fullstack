import { MongoTaskRepository } from "../repository/task.mongo.repository.js";
import { MongoUserRepository } from "../repository/user.mongo.repository.js";
import { TaskService } from "../services/task.service.js";

const mongoTask = new MongoTaskRepository();
const mongoUser = new MongoUserRepository();

export const TaskController = {
	taskAll: async (req, res) => {
		const tasks = await mongoTask.getAll();

		if (tasks.length == 0) {
			res.status(404).json({
				payload: null,
				message: "No se encontró ninguna tarea",
				ok: false,
			});
			return;
		}

		res.status(200).json({
			message: "Success ---> Las tareas fueron halladas correctamente",
			payload: tasks,
			ok: true,
		});
	},

	taskValidation: async (req, res) => {
		const { id } = req.params;
		//const taskFoundById = await TaskService.serviceTaskValidation(id);
		const taskFoundById = await mongoTask.getById(id);

		if (!taskFoundById) {
			res.status(404).json({
				payload: null,
				message: "La tarea no fue hallada",
				ok: false,
			});
			return null;
		} else {
			res.status(200).json({
				message: "Success --> La tarea fue hallada",
				payload: { taskFoundById },
				ok: true,
			});
		}
	},

	taskCreateOne: async (req, res) => {
		const { task } = req.body;

		if (!req.user || !req.user.id) {
			return res
				.status(401)
				.json({ error: "Usuario no autenticado" });
		}

		try {
			const creatorId = req.user.id;
			const creatorSector = req.user.sector;
			const isSupervisor = req.user.isSupervisor;

			if (!task || !task.title || !task.deadline) {
				return res.status(400).json({
					error: "Datos de tarea incompletos (title, deadline son requeridos)",
				});
			}

			// Regla: siempre registramos quién creó la tarea
			const newTaskData = {
				...task,
				createdBy: creatorId,
			};

			// Regla de negocio sobre assignedTo
			if (!isSupervisor) {
				// Si NO es supervisor: se asigna a sí mismo siempre
				newTaskData.assignedTo = [creatorId];
			} else {
				// Si ES supervisor: puede asignar a otros (o a sí mismo, opcional)
				// Validamos que todos los asignados pertenezcan al mismo sector
				const assignedIds = Array.isArray(task.assignedTo)
					? task.assignedTo
					: task.assignedTo
						? [task.assignedTo]
						: [];

				if (assignedIds.length === 0) {
					// Permitimos que el supervisor cree tareas sin asignados iniciales
					newTaskData.assignedTo = [];
				} else {
					// Cargamos usuarios asignados y validamos sector
					const users = await Promise.all(
						assignedIds.map((id) => mongoUser.getById(id)),
					);

					const invalidUser = users.find(
						(u) => !u || u.sector !== creatorSector,
					);

					if (invalidUser) {
						return res.status(403).json({
							error:
								"Todos los usuarios asignados deben pertenecer al mismo sector que el creador",
						});
					}

					newTaskData.assignedTo = assignedIds;
				}
			}

			const taskResponse = await mongoTask.createOne(newTaskData);

			res.status(200).json({
				message: "Success --> La tarea ha sido creada",
				payload: { ...taskResponse, tarea: taskResponse.title },
				ok: true,
			});
			return;
		} catch (e) {
			console.log({ error: e.message, mensaje: "Algo salió mal" });
			res.status(404).json({
				payload: null,
				message: "No se pudo crear la tarea",
				ok: false,
			});
			return;
		}
	},

	taskDeleteOne: async (req, res) => {
		const { id } = req.params;
		const requestingUserId = req.user?.id;

		if (!requestingUserId) {
			return res.status(401).json({
				payload: null,
				message: "Usuario no autenticado",
				ok: false,
			});
		}

		try {
			const deletedTask = await TaskService.serviceTaskDelete(id, requestingUserId);

			if (!deletedTask) {
				return res.status(404).json({
					payload: null,
					message: `No se encontró la tarea con id: ${id}`,
					ok: false,
				});
			}

			return res.status(200).json({
				message: `Success: La tarea "${deletedTask.title}" fue eliminada`,
				payload: { deletedTask },
				ok: true,
			});
		} catch (error) {
			console.error("Error al eliminar tarea", error);

			if (error.message.includes("titular") || error.message.includes("futura")) {
				return res.status(403).json({
					payload: null,
					message: error.message,
					ok: false,
				});
			}

			return res.status(500).json({
				payload: null,
				message: error.message || "No se pudo eliminar la tarea",
				ok: false,
			});
		}
	},

	taskUpdateOne: async (req, res) => {
		const { id } = req.params;
		const { title, description, completada, completed, status, assignedTo } = req.body;
		const requestingUserId = req.user?.id;

		if (!requestingUserId) {
			return res.status(401).json({
				payload: null,
				message: "Usuario no autenticado",
				ok: false,
			});
		}

		// armamos objeto dinámico sólo con campos enviados
		const updateData = {};
		if (title !== undefined) updateData.title = title;
		if (description !== undefined) updateData.description = description;
		if (status !== undefined) updateData.status = status;
		// soporta tanto "completada" (frontend actual) como "completed" (nombre del modelo)
		if (completada !== undefined) updateData.completed = completada;
		if (completed !== undefined) updateData.completed = completed;
		// assignedTo para agregar/quitar usuarios
		if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

		try {
			const taskUpdated = await TaskService.serviceTaskUpdate(id, updateData, requestingUserId);

			if (!taskUpdated) {
				return res.status(404).json({
					payload: null,
					message: `No se puede actualizar la tarea con el id: ${id}`,
					ok: false,
				});
			}

			return res.status(200).json({
				message: "Tarea Actualizada",
				payload: taskUpdated,
				ok: true,
			});
		} catch (error) {
			console.error("Error al actualizar tarea", error);

			// Handle specific authorization/validation errors
			if (error.message.includes("titular") || 
				error.message.includes("recurrente") ||
				error.message.includes("asignado")) {
				return res.status(403).json({
					payload: null,
					message: error.message,
					ok: false,
				});
			}

			return res.status(500).json({
				payload: null,
				message: error.message || "No se pudo actualizar la tarea",
				ok: false,
			});
		}
	},

	/**
	 * Get tasks for calendar view
	 * GET /tasks/calendar?month=1&year=2026
	 */
	calendarTasks: async (req, res) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({
					payload: null,
					message: "Usuario no autenticado",
					ok: false,
				});
			}

			const month = parseInt(req.query.month, 10);
			const year = parseInt(req.query.year, 10);

			if (!month || !year || month < 1 || month > 12) {
				return res.status(400).json({
					payload: null,
					message: "Parámetros month y year son requeridos (month: 1-12)",
					ok: false,
				});
			}

			const user = {
				id: req.user.id,
				sector: req.user.sector,
				isSupervisor: req.user.isSupervisor,
			};

			const tasks = await TaskService.getCalendarTasks(user, month, year);

			return res.status(200).json({
				message: "Tareas del calendario obtenidas",
				payload: tasks,
				ok: true,
			});
		} catch (error) {
			console.error("Error al obtener tareas del calendario:", error);
			return res.status(500).json({
				payload: null,
				message: error.message || "Error al obtener tareas del calendario",
				ok: false,
			});
		}
	},
};
