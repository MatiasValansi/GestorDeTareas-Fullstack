import { RecurringTaskService } from "../services/recurring.task.service.js";
import { RecurringTaskRepository } from "../repository/recurring.task.repository.js";

export const RecurringTaskController = {
	// POST /recurring-tasks
	// Crea una tarea recurrente (solo la definición, sin tareas individuales)
	create: async (req, res) => {
		try {
			const {
				title,
				description,
				assignedTo,
				recurrenceType,
				periodicity,
				datePattern,
				numberPattern,
				date,
				deadline,
				includeWeekends,
			} = req.body;


			const result = await RecurringTaskService.create({
				title,
				description,
				assignedTo,
				recurrenceType,
				periodicity,
				datePattern,
				numberPattern,
				date,
				deadline,
				includeWeekends,
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
	// Actualiza título/descripción/assignedTo de la tarea recurrente y afecta tareas individuales
	// Solo el titular (primer usuario en assignedTo) puede modificar
	// NO permite reactivar una tarea desactivada
	update: async (req, res) => {
		try {
			const { id } = req.params;
			const { title, description, assignedTo, active } = req.body;
			const requestingUserId = req.user?.id;

			if (!requestingUserId) {
				return res.status(401).json({
					ok: false,
					message: "Usuario no autenticado",
				});
			}

			// Verificar si intentan reactivar una tarea desactivada
			if (active === true) {
				const existingTask = await RecurringTaskRepository.getById(id);
				if (existingTask && (existingTask.active === false || existingTask.deactivatedAt)) {
					return res.status(400).json({
						ok: false,
						message: "Una tarea recurrente desactivada no puede volver a activarse",
					});
				}
			}

			const result = await RecurringTaskService.update(
				id,
				{ title, description, assignedTo },
				requestingUserId
			);

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

			// Handle specific authorization error
			if (error.message === "Solo el titular de la tarea puede modificarla" ||
				error.message === "El titular no puede quitarse a sí mismo ni cambiar su posición") {
				return res.status(403).json({
					ok: false,
					message: error.message,
				});
			}

			return res.status(500).json({
				ok: false,
				message: error.message || "No se pudo actualizar la tarea recurrente",
			});
		}
	},

	// POST /recurring-tasks/generate/:year/:month
	// Genera tareas individuales para un mes específico (llamado cuando el usuario ve el calendario)
	generateTasksForMonth: async (req, res) => {
		try {
			const { year, month } = req.params;
			const createdBy = req.user?.id;

			const yearNum = parseInt(year, 10);
			const monthNum = parseInt(month, 10);

			if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
				return res.status(400).json({
					ok: false,
					message: "Año y mes inválidos. Mes debe ser entre 1 y 12",
				});
			}

			const result = await RecurringTaskService.generateTasksForMonth(
				yearNum,
				monthNum,
				createdBy
			);

			return res.status(200).json({
				message: `Tareas generadas para ${monthNum}/${yearNum}`,
				payload: result,
				ok: true,
			});
		} catch (error) {
			console.error("Error al generar tareas para el mes", error);
			return res.status(500).json({
				ok: false,
				message: error.message || "No se pudieron generar las tareas",
			});
		}
	},

	// DELETE /recurring-tasks/:id
	// Elimina la tarea recurrente Y todas sus tareas individuales asociadas
	delete: async (req, res) => {
		try {
			const { id } = req.params;
			const result = await RecurringTaskService.delete(id);

			if (!result) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			return res.status(200).json({
				message: `Tarea recurrente eliminada junto con ${result.deletedIndividualTasks} tareas individuales`,
				payload: result,
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

	// DEACTIVATE /recurring-tasks/:id
	// Desactiva la tarea recurrente Y borra todas sus tareas individuales FUTURAS NO COMPLETADAS
	// Una vez desactivada, NO se puede volver a activar
	deactivate: async (req, res) => {
		try {
			const { id } = req.params;
			const result = await RecurringTaskService.deactivate(id);

			if (!result) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			return res.status(200).json({
				message: `Tarea recurrente desactivada correctamente. ${result.deletedFutureTasks || 0} tareas futuras eliminadas.`,
				payload: result,
				ok: true,
			});
		} catch (error) {
			console.error("Error al desactivar tarea recurrente", error);
			
			// Error específico si ya está desactivada
			if (error.message?.includes("ya fue desactivada")) {
				return res.status(400).json({
					ok: false,
					message: error.message,
				});
			}

			return res.status(500).json({
				ok: false,
				message: error.message || "No se pudo desactivar la tarea recurrente",
			});
		}
	},
};
