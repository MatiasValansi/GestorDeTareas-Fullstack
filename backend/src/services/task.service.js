import { MongoTaskRepository } from "../repository/task.mongo.repository.js";
import { MongoUserRepository } from "../repository/user.mongo.repository.js";
import { ArgentinaTime } from "../utils/argentinaTime.js";
import { RecurringTaskService } from "./recurring.task.service.js";

/**
 * TaskService - Capa de lógica de negocio para tareas
 * 
 * Responsabilidades:
 * - Contener TODA la lógica de negocio de tareas
 * - Validar reglas de negocio (fechas, asignaciones, permisos)
 * - Orquestar llamadas a repositorios
 * 
 * Principios Clean Architecture:
 * - El Service NO conoce HTTP (req/res)
 * - El Service NO accede directamente a Mongoose (usa repositorios)
 * - Lanza errores de negocio que el Controller traduce a HTTP
 */
class TaskServiceClass {
	constructor(taskRepository, userRepository) {
		this.taskRepository = taskRepository;
		this.userRepository = userRepository;
	}

    // Util: normaliza cualquier id/Document/ObjectId a string
    _toIdString(val) {
        if (!val) return null;
        if (typeof val === "string") return val;
        if (val._id) return String(val._id);
        try { return String(val); } catch { return null; }
    }

    _getTaskOwnerId(task) {
        if (!task.assignedTo || task.assignedTo.length === 0) return null;
        const firstAssigned = task.assignedTo[0];
        return this._toIdString(firstAssigned);
    }

    _validateCanEdit(task, userIdRaw) {
        const userId = this._toIdString(userIdRaw);
        const taskOwner = this._getTaskOwnerId(task);

        if (!taskOwner || !userId || taskOwner !== userId) {
            throw new Error("Solo el titular de la tarea (posición 0 en asignados) puede editarla");
        }
        if (task.status === "VENCIDA") {
            throw new Error("No se pueden editar tareas vencidas");
        }
        if (task.recurringTaskId) {
            throw new Error("No se pueden editar tareas recurrentes. Modifique la tarea recurrente original.");
        }
    }

	// ═══════════════════════════════════════════════════════════════════
	// VALIDACIONES DE NEGOCIO (privadas)
	// ═══════════════════════════════════════════════════════════════════

	/**
	 * Valida que deadline >= date
	 * @param {Date} date - Fecha de la tarea
	 * @param {Date} deadline - Fecha de vencimiento
	 * @throws {Error} Si deadline < date
	 */
	_validateDates(date, deadline) {
		if (!date || !deadline) {
			throw new Error("Las fechas 'date' y 'deadline' son obligatorias");
		}

		const taskDate = new Date(date);
		const taskDeadline = new Date(deadline);

		if (taskDeadline < taskDate) {
			throw new Error("La fecha de vencimiento (deadline) debe ser igual o posterior a la fecha de la tarea (date)");
		}
	}

	/**
	 * Valida y determina los usuarios asignados según el rol del creador
	 * @param {Object} creator - Usuario creador {id, sector, isSupervisor}
	 * @param {Array} assignedTo - Array de IDs de usuarios a asignar
	 * @returns {Promise<Array>} Array de IDs validados
	 * @throws {Error} Si las asignaciones son inválidas
	 */
	async _validateAndResolveAssignees(creator, assignedTo) {
		const { id: creatorId, sector: creatorSector, isSupervisor } = creator;

		// Si NO es supervisor: se asigna a sí mismo siempre
		if (!isSupervisor) {
			return [creatorId];
		}

		// Si ES supervisor: puede asignar a otros
		const assignedIds = Array.isArray(assignedTo)
			? assignedTo
			: assignedTo
				? [assignedTo]
				: [];

		// Permitimos tareas sin asignados iniciales para supervisores
		if (assignedIds.length === 0) {
			return [];
		}

		// Validar que todos los asignados pertenezcan al mismo sector
		const users = await Promise.all(
			assignedIds.map((id) => this.userRepository.getById(id))
		);

		const invalidUser = users.find(
			(u) => !u || u.sector !== creatorSector
		);

		if (invalidUser !== undefined) {
			throw new Error("Todos los usuarios asignados deben pertenecer al mismo sector que el creador");
		}

		return assignedIds;
	}

	// ═══════════════════════════════════════════════════════════════════
	// MÉTODOS PÚBLICOS - Casos de Uso
	// ═══════════════════════════════════════════════════════════════════

	/**
	 * Obtiene todas las tareas
	 * @returns {Promise<Array>} Lista de tareas
	 */
	async getAllTasks() {
		const tasks = await this.taskRepository.getAll();
		return tasks || [];
	}

	/**
	 * Obtiene una tarea por ID
	 * @param {string} taskId - ID de la tarea
	 * @returns {Promise<Object|null>} Tarea encontrada o null
	 */
	async getTaskById(taskId) {
		const task = await this.taskRepository.getById(taskId);
		return task || null;
	}

	/**
	 * Crea una nueva tarea
	 * 
	 * Reglas de negocio:
	 * 1. title y deadline son obligatorios
	 * 2. deadline >= date
	 * 3. Si NO es supervisor: se asigna a sí mismo
	 * 4. Si ES supervisor: puede asignar a usuarios del mismo sector
	 * 
	 * @param {Object} taskData - Datos de la tarea {title, description, date, deadline, assignedTo}
	 * @param {Object} creator - Usuario creador {id, sector, isSupervisor}
	 * @returns {Promise<Object>} Tarea creada
	 * @throws {Error} Si los datos son inválidos
	 */
	async createTask(taskData, creator) {
		const { title, description, date, deadline, assignedTo, status } = taskData;

		// Validación: campos requeridos
		if (!title || !deadline) {
			throw new Error("Datos de tarea incompletos (title, deadline son requeridos)");
		}

		// Validación: date es requerido
		if (!date) {
			throw new Error("La fecha de la tarea (date) es requerida");
		}

		// Validación de fechas: deadline >= date
		this._validateDates(date, deadline);

		// Resolver asignados según rol del creador
		const validatedAssignees = await this._validateAndResolveAssignees(creator, assignedTo);

		// Construir datos de la tarea
		const newTaskData = {
			title,
			description,
			date: new Date(date),
			deadline: new Date(deadline),
			createdBy: creator.id,
			assignedTo: validatedAssignees,
			status: status || "PENDIENTE",
		};

		// Persistir en repositorio
		const createdTask = await this.taskRepository.createOne(newTaskData);

		// Convertir a objeto plano para evitar estructuras circulares
		return typeof createdTask?.toObject === "function"
			? createdTask.toObject()
			: createdTask;
	}

	/**
	 * Actualiza una tarea existente
	 * 
	 * Reglas de negocio:
	 * 1. No se puede modificar assignedTo de tareas recurrentes
	 * 2. Solo el titular puede modificar assignedTo
	 * 3. El titular no puede quitarse a sí mismo
	 * 4. Si se actualiza date/deadline: deadline >= date
	 * 
	 * @param {string} taskId - ID de la tarea
	 * @param {Object} updateData - Datos a actualizar
	 * @param {Object} requestingUser - Usuario que solicita la actualización
	 * @returns {Promise<Object|null>} Tarea actualizada o null
	 * @throws {Error} Si la operación no está permitida
	 */
	async updateTask(taskId, updateData, requestingUser) {
		// Obtener tarea actual
		const currentTask = await this.taskRepository.getById(taskId);
		if (!currentTask) return null;

		// ===== VALIDACIÓN DE PERMISOS =====
		const taskOwner = this._getTaskOwnerId(currentTask);
		const isAssigned = currentTask.assignedTo
		?.map(id => id.toString())
		.includes(requestingUser.id);

		// Usuario normal
		if (!requestingUser.isSupervisor) {
		if (!isAssigned) {
			throw new Error("No puede editar una tarea que no le pertenece");
		}

		if (currentTask.status === "VENCIDA") {
			throw new Error("No se puede editar una tarea vencida");
		}
		}

		// Supervisor
		// (si querés restringir por sector, va acá)


		// Validar fechas si se están actualizando
		if (updateData.date !== undefined || updateData.deadline !== undefined) {
			const newDate = updateData.date !== undefined 
				? new Date(updateData.date) 
				: currentTask.date;
			const newDeadline = updateData.deadline !== undefined 
				? new Date(updateData.deadline) 
				: currentTask.deadline;
			
			this._validateDates(newDate, newDeadline);
		}

		// Validaciones especiales para assignedTo
		if (updateData.assignedTo !== undefined) {
			if (currentTask.recurringTaskId) {
				throw new Error("No se puede modificar asignados de una tarea recurrente");
			}

			const taskOwner = this._getTaskOwnerId(currentTask);

			if (!requestingUser.isSupervisor && taskOwner !== requestingUser.id) {
				throw new Error("Solo el titular puede modificar los asignados");
			}

			if (!Array.isArray(updateData.assignedTo) || updateData.assignedTo.length < 1) {
				throw new Error("La tarea debe tener al menos un usuario asignado");
			}

			const newFirstUser = updateData.assignedTo[0].toString();
			if (newFirstUser !== taskOwner) {
				throw new Error("El titular no puede quitarse a sí mismo");
			}
			}
		
		

		// Realizar actualización vía repositorio
		const taskUpdated = await this.taskRepository.updateOne(taskId, updateData);
		return taskUpdated;
	}

	/**
	 * Elimina una tarea
	 * 
	 * Reglas de negocio:
	 * 1. Solo el titular puede eliminar
	 * 2. Solo se pueden eliminar tareas con deadline futuro
	 * 
	 * @param {string} taskId - ID de la tarea
	 * @param {string} requestingUser - ID del usuario que solicita
	 * @returns {Promise<Object|null>} Tarea eliminada o null
	 * @throws {Error} Si la operación no está permitida
	 */
	async deleteTask(taskId, requestingUser) {
		// Obtener tarea a eliminar
		const taskToDelete = await this.taskRepository.getById(taskId);
		if (!taskToDelete) return null;

		// Regla 1: Solo el titular puede eliminar
		const taskOwner = this._getTaskOwnerId(taskToDelete);
		if (!taskOwner || taskOwner !== requestingUser) {
			throw new Error("Solo el titular de la tarea puede eliminarla");
		}

		// Regla 2: Solo eliminar tareas con deadline futuro
		if (taskToDelete.deadline && ArgentinaTime.isExpired(taskToDelete.deadline)) {
			throw new Error("Solo se pueden eliminar tareas con fecha de vencimiento futura (hora Argentina)");
		}

		// Realizar eliminación
		await this.taskRepository.deleteOne(taskId);
		return taskToDelete;
	}

	/**
	 * Obtiene tareas para la vista de calendario
	 * 
	 * Reglas de negocio:
	 * - Supervisor: todas las tareas de usuarios de su sector
	 * - Usuario regular: solo tareas donde está asignado
	 * 
	 * @param {Object} user - Usuario {id, sector, isSupervisor}
	 * @param {number} month - Mes (1-12)
	 * @param {number} year - Año
	 * @returns {Promise<Array>} Tareas del período
	 */
	async getCalendarTasks(user, month, year) {
		// Generar tareas recurrentes (idempotente por índice único)
		await RecurringTaskService.generateTasksForMonth(year, month, user.id);

		// Calcular rango de fechas (incluir días visibles de meses adyacentes)
		const startDate = new Date(Date.UTC(year, month - 1, 1));
		startDate.setUTCDate(startDate.getUTCDate() - 7);

		const endDate = new Date(Date.UTC(year, month, 0)); // Último día del mes
		endDate.setUTCDate(endDate.getUTCDate() + 7);
		endDate.setUTCHours(23, 59, 59, 999);

		let userIdsToQuery;

		if (user.isSupervisor) {
			// Supervisor: obtener usuarios del mismo sector
			const usersInSector = await this.userRepository.getBySector(user.sector);
			userIdsToQuery = usersInSector.map((u) => u._id);
		} else {
			// Usuario regular: solo sus tareas
			userIdsToQuery = [user.id];
		}

		// Consultar tareas vía repositorio
		const tasks = await this.taskRepository.getByDateRangeAndUsers(
			startDate,
			endDate,
			userIdsToQuery
		);

		return tasks;
	}

	// ═══════════════════════════════════════════════════════════════════
	// MÉTODOS AUXILIARES
	// ═══════════════════════════════════════════════════════════════════

	/**
	 * Marca como VENCIDAS todas las tareas cuyo deadline ya pasó
	 * @returns {Promise<Object>} Resultado con cantidad de tareas actualizadas
	 */
	async markExpiredTasks() {
		const now = new Date();

		console.log(`[markExpiredTasks] Verificando tareas vencidas.`);
		console.log(`  → Hora UTC actual: ${now.toISOString()}`);
		console.log(`  → Hora Argentina:  ${ArgentinaTime.format(now)}`);

		const result = await this.taskRepository.markExpiredTasks(now);

		if (result.modifiedCount > 0) {
			console.log(`  → Se marcaron ${result.modifiedCount} tareas como VENCIDAS`);
		} else {
			console.log(`  → No hay tareas para marcar como vencidas`);
		}

		return { modifiedCount: result.modifiedCount };
	}

	/**
	 * Obtiene tareas en un rango de fechas para ciertos usuarios
	 * @param {Date} from - Fecha inicio
	 * @param {Date} to - Fecha fin
	 * @param {Array} userIds - IDs de usuarios
	 * @returns {Promise<Array>} Tareas encontradas
	 */
	async getTasksBetween(from, to, userIds) {
		await this.markExpiredTasks();
		return this.taskRepository.getByDateRangeAndUsers(from, to, userIds);
	}

	// ═══════════════════════════════════════════════════════════════════
	// MÉTODOS LEGACY (compatibilidad hacia atrás)
	// ═══════════════════════════════════════════════════════════════════

	/**
	 * @deprecated Use deleteTask() instead
	 */
	async serviceTaskDelete(id, requestingUser) {
		return this.deleteTask(id, requestingUser);
	}

	/**
	 * @deprecated Use updateTask() instead
	 */
	async serviceTaskUpdate(id, updateData, requestingUser) {
		return this.updateTask(id, updateData, requestingUser);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON - Instancia única con dependencias inyectadas
// ═══════════════════════════════════════════════════════════════════════════

const taskRepository = new MongoTaskRepository();
const userRepository = new MongoUserRepository();

export const TaskService = new TaskServiceClass(taskRepository, userRepository);
