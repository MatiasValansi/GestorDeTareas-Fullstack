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

	// GET /recurring-tasks/my-tasks
	// Obtiene las tareas recurrentes según el rol del usuario:
	// - Usuario normal: solo las que tiene asignadas
	// - Supervisor: todas las de usuarios de su mismo sector
	getMyTasks: async (req, res) => {
		try {
			const { user } = req;
			let tasks;

			if (user.isSupervisor) {
				// Supervisor: obtener todas las tareas donde hay usuarios de su sector
				tasks = await RecurringTaskRepository.getBySector(user.sector);
			} else {
				// Usuario normal: solo sus tareas asignadas
				tasks = await RecurringTaskRepository.getByAssignedUser(user.id);
			}

			return res.status(200).json({
				message: "Tareas recurrentes obtenidas correctamente",
				payload: tasks,
				ok: true,
			});
		} catch (error) {
			console.error("Error al obtener mis tareas recurrentes", error);
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

	// GET /recurring-tasks/detail/:id
	// Obtiene una tarea recurrente por id validando permisos:
	// - Usuario normal: solo si está asignado a la tarea
	// - Supervisor: si hay algún usuario asignado de su mismo sector
	getByIdForUser: async (req, res) => {
		try {
			const { id } = req.params;
			const { user } = req;
			const task = await RecurringTaskRepository.getById(id);

			if (!task) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			// Verificar permisos
			const isAssigned = task.assignedTo.some(assigned => {
				const assignedId = typeof assigned === 'object' 
					? String(assigned._id || assigned.id) 
					: String(assigned);
				return assignedId === String(user.id);
			});

			const hasSameSectorUser = user.isSupervisor && task.assignedTo.some(assigned => {
				if (typeof assigned === 'object' && assigned.sector) {
					return assigned.sector === user.sector;
				}
				return false;
			});

			if (!isAssigned && !hasSameSectorUser) {
				return res.status(403).json({
					ok: false,
					message: "No tiene permisos para ver esta tarea recurrente",
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
	// Actualiza SOLO la lista de usuarios asignados (assignedTo) de la tarea recurrente
	// Solo el titular (posición 0 en assignedTo) puede modificar, independientemente de si es Supervisor
	// El titular no puede eliminarse a sí mismo de la tarea
	// Las tareas pasadas NO se modifican, solo reciben una leyenda de modificación
	// Las tareas futuras se actualizan con el nuevo assignedTo
	update: async (req, res) => {
		try {
			const { id } = req.params;
			const { assignedTo } = req.body;
			const requestingUserId = req.user?.id;

			if (!requestingUserId) {
				return res.status(401).json({
					ok: false,
					message: "Usuario no autenticado",
				});
			}

			// Validar que se proporcione assignedTo
			if (assignedTo === undefined) {
				return res.status(400).json({
					ok: false,
					message: "Se debe proporcionar la lista de usuarios asignados (assignedTo)",
				});
			}

			const result = await RecurringTaskService.update(
				id,
				{ assignedTo },
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
				message: `Tarea recurrente actualizada. ${result.changeType}`,
				payload: result,
				ok: true,
			});
		} catch (error) {
			console.error("Error al actualizar tarea recurrente", error);

			// Handle specific authorization/validation errors
			const forbiddenMessages = [
				"Solo el titular de la tarea (posición 0 del assignedTo) puede modificarla",
				"El titular no puede quitarse a sí mismo ni cambiar su posición",
			];

			const badRequestMessages = [
				"Solo se permite modificar la lista de usuarios asignados (assignedTo)",
				"Se debe proporcionar la lista de usuarios asignados (assignedTo)",
				"assignedTo debe ser un array",
				"La tarea debe tener al menos un usuario asignado",
				"No se puede modificar una tarea recurrente desactivada",
			];

			if (forbiddenMessages.includes(error.message)) {
				return res.status(403).json({
					ok: false,
					message: error.message,
				});
			}

			if (badRequestMessages.includes(error.message)) {
				return res.status(400).json({
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
	// Solo el titular (posición 0 del assignedTo) puede desactivar
	deactivate: async (req, res) => {
		try {
			const { id } = req.params;
			const { user } = req;

			// Obtener la tarea para validar permisos
			const task = await RecurringTaskRepository.getById(id);

			if (!task) {
				return res.status(404).json({
					ok: false,
					message: "Tarea recurrente no encontrada",
					payload: null,
				});
			}

			// Validar que el usuario sea el titular (posición 0 del assignedTo)
			if (!task.assignedTo || task.assignedTo.length === 0) {
				return res.status(403).json({
					ok: false,
					message: "La tarea no tiene usuarios asignados",
				});
			}

			const titular = task.assignedTo[0];
			const titularId = typeof titular === 'object' 
				? String(titular._id || titular.id) 
				: String(titular);
			
			if (titularId !== String(user.id)) {
				return res.status(403).json({
					ok: false,
					message: "Solo el titular de la tarea puede desactivarla",
				});
			}

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
