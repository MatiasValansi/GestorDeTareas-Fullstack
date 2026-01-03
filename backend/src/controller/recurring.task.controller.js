import { RecurringTaskService } from "../services/recurring.task.service.js";
import { RecurringTaskRepository } from "../repository/recurring.task.repository.js";

export const RecurringTaskController = {
	// POST /recurring-tasks
	// Crea una tarea recurrente y las tareas individuales asociadas
	create: async (req, res) => {
		try {
			const createdBy = req.user?.id;
			const {
				title,
				description,
				assignedTo,
				recurrenceType,
				periodicity,
				datePattern,
				numberPattern,
				startingFrom,
				maxWindow,
			} = req.body;


			const result = await RecurringTaskService.create({
				title,
				description,
				assignedTo,
				createdBy,
				recurrenceType,
				periodicity,
				datePattern,
				numberPattern,
				startingFrom,
				maxWindow,
			});


			return res.status(201).json({
				message: "Tarea recurrente creada correctamente",
				payload: result,
				ok: true,
			});
		} catch (error) {
			console.error("Error al crear tarea recurrente", error);
			return res.status(400).json({
				ok: false,
				message: error.message || "No se pudo crear la tarea recurrente",
			});
		}
	},

	// GET /recurring-tasks
	// Obtiene todas las tareas recurrentes
	getAll: async (_req, res) => {
		try {
			const tasks = await RecurringTaskRepository.getAll();
			return res.status(200).json({
				message: "Tareas recurrentes obtenidas correctamente",
				payload: tasks,
				ok: true,
			});
		} catch (error) {
			console.error("Error al obtener tareas recurrentes", error);
			return res.status(500).json({
				ok: false,
				message: "No se pudieron obtener las tareas recurrentes",
			});
		}
	},

	// GET /recurring-tasks/:id
	// Obtiene una tarea recurrente por id
	getById: async (req, res) => {
		try {
			const { id } = req.params;
			const task = await RecurringTaskRepository.getById(id);

			if (!task) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			return res.status(200).json({
				message: "Tarea recurrente encontrada",
				payload: task,
				ok: true,
			});
		} catch (error) {
			console.error("Error al obtener tarea recurrente", error);
			return res.status(500).json({
				ok: false,
				message: "No se pudo obtener la tarea recurrente",
			});
		}
	},

	// PUT /recurring-tasks/:id
	// Actualiza título/descripcion de la tarea recurrente y afecta tareas individuales
	update: async (req, res) => {
		try {
			const { id } = req.params;
			const { title, description } = req.body;

			const result = await RecurringTaskService.update(id, {
				title,
				description,
			});

			if (!result) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			return res.status(200).json({
				message: "Tarea recurrente actualizada",
				payload: result,
				ok: true,
			});
		} catch (error) {
			console.error("Error al actualizar tarea recurrente", error);
			return res.status(500).json({
				ok: false,
				message: "No se pudo actualizar la tarea recurrente",
			});
		}
	},

	// POST /recurring-tasks/:id/regenerate
	// Regenera tareas individuales dentro de una nueva ventana
	regenerate: async (req, res) => {
		try {
			const { id } = req.params;
			const { newStartFrom, newWindow } = req.body;
			const createdBy = req.user?.id;
			const result = await RecurringTaskService.regenerateTasks(
				id,
				newStartFrom,
				newWindow,
				createdBy,
			);

			return res.status(200).json({
				message: "Tareas individuales regeneradas correctamente",
				payload: result,
				ok: true,
			});
		} catch (error) {
			console.error("Error al regenerar tareas", error);
			return res.status(400).json({
				ok: false,
				message: error.message || "No se pudieron regenerar las tareas",
			});
		}
	},

	// DELETE /recurring-tasks/:id
	// Elimina la tarea recurrente
	delete: async (req, res) => {
		try {
			const { id } = req.params;
			const deleted = await RecurringTaskRepository.deleteById(id);

			if (!deleted) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			return res.status(200).json({
				message: "Tarea recurrente eliminada",
				payload: deleted,
				ok: true,
			});
		} catch (error) {
			console.error("Error al eliminar tarea recurrente", error);
			return res.status(500).json({
				ok: false,
				message: "No se pudo eliminar la tarea recurrente",
			});
		}
	},
};
