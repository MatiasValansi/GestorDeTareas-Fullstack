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
		//const taskDeleted = await TaskService.serviceTaskDelete(id);
		const deletedTask = await mongoTask.getById(id);
		const title = deletedTask.title;
		const taskDeleted = await mongoTask.deleteOne(id);

		if (!taskDeleted) {
			res.status(404).json({
				payload: null,
				message: `No se pudo eliminar la tarea con id: ${id}`,
				ok: false,
			});
			return;
		}

		res.status(200).json({
			message: `Success: La tarea "${title}" fue eliminada`,
			payload: { deletedTask },
			ok: true,
		});
		return;
	},

	taskUpdateOne: async (req, res) => {
		const { id } = req.params;
		const { title, description, completada, completed } = req.body;

		// armamos objeto dinámico sólo con campos enviados
		const updateData = {};
		if (title !== undefined) updateData.title = title;
		if (description !== undefined) updateData.description = description;
		// soporta tanto "completada" (frontend actual) como "completed" (nombre del modelo)
		if (completada !== undefined) updateData.completed = completada;
		if (completed !== undefined) updateData.completed = completed;

		/*
		const taskUpdated = await TaskService.serviceTaskUpdate(
			id,
			title,
			description,
		);
		*/
		const taskUpdated = await mongoTask.updateOne(id, updateData);

		if (!taskUpdated) {
			res.status(404).json({
				payload: null,
				message: `No se puede actualizar la tarea con el id: ${id}`,
				ok: false,
			});
			return;
		}

		res.status(200).json({
			message: "Tarea Actualizada",
			payload: taskUpdated,
			ok: true,
		});
		return;
	},
};
