import { TaskService } from "../services/task.service.js";

/**
 * TaskController - Capa HTTP para tareas
 * 
 * Responsabilidades:
 * - Validar presencia de req.user (autenticación)
 * - Extraer parámetros (req.params, req.body, req.query)
 * - Delegar TODA la lógica al TaskService
 * - Traducir resultados/errores a respuestas HTTP
 * 
 * Principios Clean Architecture:
 * - El Controller NO contiene lógica de negocio
 * - El Controller NO accede a repositorios directamente
 * - El Controller solo hace HTTP in → Service → HTTP out
 */
export const TaskController = {
	/**
	 * GET /allTasks
	 * Obtiene todas las tareas
	 */
	taskAll: async (req, res) => {
		try {
			const tasks = await TaskService.getAllTasks();

			if (tasks.length === 0) {
				return res.status(404).json({
					payload: null,
					message: "No se encontró ninguna tarea",
					ok: false,
				});
			}

			return res.status(200).json({
				message: "Success ---> Las tareas fueron halladas correctamente",
				payload: tasks,
				ok: true,
			});
		} catch (error) {
			console.error("Error al obtener tareas:", error);
			return res.status(500).json({
				payload: null,
				message: error.message || "Error al obtener tareas",
				ok: false,
			});
		}
	},

	/**
	 * GET /task/:id
	 * Obtiene una tarea por ID
	 */
	taskValidation: async (req, res) => {
		try {
			const { id } = req.params;
			const task = await TaskService.getTaskById(id);

			if (!task) {
				return res.status(404).json({
					payload: null,
					message: "La tarea no fue hallada",
					ok: false,
				});
			}

			return res.status(200).json({
				message: "Success --> La tarea fue hallada",
				payload: { taskFoundById: task },
				ok: true,
			});
		} catch (error) {
			console.error("Error al buscar tarea:", error);
			return res.status(500).json({
				payload: null,
				message: error.message || "Error al buscar tarea",
				ok: false,
			});
		}
	},

	/**
	 * POST /task
	 * Crea una nueva tarea
	 */
	taskCreateOne: async (req, res) => {
		// Validar autenticación (HTTP concern)
		if (!req.user || !req.user.id) {
			return res.status(401).json({
				payload: null,
				message: "Usuario no autenticado",
				ok: false,
			});
		}

		try {
			// Extraer datos del request
			const { task } = req.body;
			const creator = {
				id: req.user.id,
				sector: req.user.sector,
				isSupervisor: req.user.isSupervisor,
			};

			// Delegar al Service
			const createdTask = await TaskService.createTask(task, creator);

			return res.status(201).json({
				message: "Success --> La tarea ha sido creada",
				payload: createdTask,
				ok: true,
			});
		} catch (error) {
			console.error("Error al crear tarea:", error);

			// Traducir errores de negocio a HTTP
			if (error.message.includes("incompletos") || 
				error.message.includes("requerido") ||
				error.message.includes("requerida") ||
				error.message.includes("deadline")) {
				return res.status(400).json({
					payload: null,
					message: error.message,
					ok: false,
				});
			}

			if (error.message.includes("sector")) {
				return res.status(403).json({
					payload: null,
					message: error.message,
					ok: false,
				});
			}

			return res.status(500).json({
				payload: null,
				message: error.message || "No se pudo crear la tarea",
				ok: false,
			});
		}
	},

	/**
	 * PUT /task/:id
	 * Actualiza una tarea existente
	 */
	taskUpdateOne: async (req, res) => {
		// Validar autenticación
		if (!req.user || !req.user.id) {
			return res.status(401).json({
				payload: null,
				message: "Usuario no autenticado",
				ok: false,
			});
		}

		try {
			// Extraer datos del request
			const { id } = req.params;
			const { title, description, completada, completed, status, assignedTo, date, deadline } = req.body;
			const requestingUser = req.user;

			// Construir objeto con campos enviados
			const updateData = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;
			if (completada !== undefined) updateData.completed = completada;
			if (completed !== undefined) updateData.completed = completed;
			if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
			if (date !== undefined) updateData.date = date;
			if (deadline !== undefined) updateData.deadline = deadline;

			// Delegar al Service
			const taskUpdated = await TaskService.updateTask(id, updateData, requestingUser);

			if (skUpdated) {
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
			console.error("Error al actualizar tarea:", error);

			// Traducir errores de negocio a HTTP
			if (error.message.includes("titular") ||
				error.message.includes("recurrente") ||
				error.message.includes("asignado") ||
				error.message.includes("deadline") ||
				error.message.includes("vencimiento")) {
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
	 * DELETE /task/:id
	 * Elimina una tarea
	 */
	taskDeleteOne: async (req, res) => {
		// Validar autenticación
		if (!req.user || !req.user.id) {
			return res.status(401).json({
				payload: null,
				message: "Usuario no autenticado",
				ok: false,
			});
		}

		try {
			// Extraer datos del request
			const { id } = req.params;
			const requestingUser = req.user;

			// Delegar al Service
			const deletedTask = await TaskService.deleteTask(id, requestingUser);

			if (letedTask) {
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
			console.error("Error al eliminar tarea:", error);

			// Traducir errores de negocio a HTTP
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

	/**
	 * GET /calendar?month=1&year=2026
	 * Obtiene tareas para vista de calendario
	 */
	calendarTasks: async (req, res) => {
		// Validar autenticación
		if (!req.user || !req.user.id) {
			return res.status(401).json({
				payload: null,
				message: "Usuario no autenticado",
				ok: false,
			});
		}

		try {
			// Extraer y validar parámetros de query
			const month = parseInt(req.query.month, 10);
			const year = parseInt(req.query.year, 10);

			if (!month || !year || month < 1 || month > 12) {
				return res.status(400).json({
					payload: null,
					message: "Parámetros month y year son requeridos (month: 1-12)",
					ok: false,
				});
			}

			// Construir objeto de usuario
			const user = {
				id: req.user.id,
				sector: req.user.sector,
				isSupervisor: req.user.isSupervisor,
			};

			// Delegar al Service
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
