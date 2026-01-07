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
				startingFrom,
			} = req.body;


			const result = await RecurringTaskService.create({
				title,
				description,
				assignedTo,
				recurrenceType,
				periodicity,
				datePattern,
				numberPattern,
				startingFrom,
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
};
