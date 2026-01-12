import { TaskModel } from "../model/Task.js";
import { TaskRepository } from "../repository/task.repository.js";
import { ArgentinaTime } from "../utils/argentinaTime.js";
import { RecurringTaskService } from "./recurring.task.service.js"


export const TaskService = {
	serviceTaskValidation: async (id) => {
		const idTask = await TaskRepository.getById(id);
		if (!idTask) return null;

		return idTask;
	},

	serviceTaskCreation: async (taskToCreate) => {
		const dataTask = {
			...taskToCreate,
			id: crypto.randomUUID().toString(),
		};

		const modelTaskToCreate = new Task(
			dataTask.id,
			dataTask.title,
			dataTask.description,
			dataTask.userId,
		);

		const taskCreated = await TaskRepository.createOne(modelTaskToCreate);

		return taskCreated;
	},

	/**
	 * Deletes a task if it's in the future and the requesting user is the owner
	 * @param {string} id - Task MongoDB ObjectId
	 * @param {string} requestingUserId - User making the request
	 * @returns {Promise<Object|null>} Deleted task or null if not found
	 */
	serviceTaskDelete: async (id, requestingUserId) => {
		// Get the task to validate
		const taskToDelete = await TaskModel.findById(id).populate("assignedTo", "name email");
		if (!taskToDelete) return null;

		// Rule 1: Only the owner (first in assignedTo) can delete
		const taskOwner = taskToDelete.assignedTo[0]?._id
			? taskToDelete.assignedTo[0]._id.toString()
			: taskToDelete.assignedTo[0]?.toString();

		if (!taskOwner || taskOwner !== requestingUserId) {
			throw new Error("Solo el titular de la tarea puede eliminarla");
		}

		// Rule 2: Can only delete future tasks (deadline > now in Argentina time)
		if (taskToDelete.deadline && ArgentinaTime.isExpired(taskToDelete.deadline)) {
			throw new Error("Solo se pueden eliminar tareas con fecha de vencimiento futura (hora Argentina)");
		}

		// Perform deletion
		await TaskModel.findByIdAndDelete(id);
		return taskToDelete;
	},

	/**
	 * Updates a task's fields (title, description, status, assignedTo)
	 * @param {string} id - Task MongoDB ObjectId
	 * @param {Object} updateData - Fields to update
	 * @param {string} requestingUserId - User making the request (for assignedTo validation)
	 * @returns {Promise<Object|null>} Updated task or null if not found
	 */
	serviceTaskUpdate: async (id, updateData, requestingUserId) => {
		// Get current task to validate
		const currentTask = await TaskModel.findById(id);
		if (!currentTask) return null;

		// If trying to modify assignedTo, apply special validations
		if (updateData.assignedTo !== undefined) {
			// Rule 1: Cannot modify assignedTo if task belongs to a recurring task
			if (currentTask.recurringTaskId) {
				throw new Error("No se puede modificar asignados de una tarea recurrente. Modifique desde la tarea recurrente.");
			}

			// Rule 2: Only the task owner (first in assignedTo) can modify
			const taskOwner = currentTask.assignedTo[0]?._id
				? currentTask.assignedTo[0]._id.toString()
				: currentTask.assignedTo[0]?.toString();

			if (!taskOwner || taskOwner !== requestingUserId) {
				throw new Error("Solo el titular de la tarea puede modificar los asignados");
			}

			// Rule 3: Validate assignedTo is an array with at least one user
			if (!Array.isArray(updateData.assignedTo) || updateData.assignedTo.length < 1) {
				throw new Error("La tarea debe tener al menos un usuario asignado");
			}

			// Rule 4: Owner cannot remove themselves (must remain first)
			const newFirstUser = updateData.assignedTo[0].toString();
			if (newFirstUser !== taskOwner) {
				throw new Error("El titular no puede quitarse a sí mismo ni cambiar su posición");
			}
		}

		// Perform the update
		const taskUpdated = await TaskModel.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true, runValidators: true }
		).populate("assignedTo", "name email");

		return taskUpdated;
	},

	serviceTaskGetAll: () => {
		const tasks = TaskRepository.getAll();

		if (!tasks) return null;

		return tasks;
	},

	/**
	 * Marca como VENCIDAS todas las tareas cuyo deadline (UTC) ya pasó
	 * y no están completadas.
	 * 
	 * LÓGICA:
	 * - deadline en BD: UTC (ej: 2026-01-10T22:00:00Z = 19:00 Argentina)
	 * - now: UTC actual (ej: 2026-01-10T22:01:00Z = 19:01 Argentina)
	 * - Si deadline < now → VENCIDA
	 * 
	 * @returns {Promise<Object>} Resultado con cantidad de tareas actualizadas
	 */
	async markExpiredTasks() {
		const now = new Date(); // Hora actual en UTC
		
		console.log(`[markExpiredTasks] Verificando tareas vencidas.`);
		console.log(`  → Hora UTC actual: ${now.toISOString()}`);
		console.log(`  → Hora Argentina:  ${ArgentinaTime.format(now)}`);
		
		const result = await TaskModel.updateMany(
			{
				status: "PENDIENTE", // Solo marcar las pendientes como vencidas
				deadline: { $lt: now }, // deadline (UTC) < ahora (UTC)
			},
			{
				$set: { status: "VENCIDA" },
			},
		);
		
		if (result.modifiedCount > 0) {
			console.log(`  → Se marcaron ${result.modifiedCount} tareas como VENCIDAS`);
		} else {
			console.log(`  → No hay tareas para marcar como vencidas`);
		}
		
		return { modifiedCount: result.modifiedCount };
	},

	async getTasksBetween(from, to, userIds) {
		await this.markExpiredTasks();

		return TaskModel.find({
			assignedTo: { $in: userIds },
			deadline: { $gte: from, $lte: to },
		});
	},

	/**
	 * Get tasks for calendar view based on user role
	 * - Supervisor: all tasks from users in the same sector
	 * - Regular user: only tasks where they are assigned
	 * @param {Object} user - The requesting user {id, sector, isSupervisor}
	 * @param {number} month - Month (1-12)
	 * @param {number} year - Year
	 * @returns {Promise<Array>} Tasks with assignedTo populated
	 */
	async getCalendarTasks(user, month, year) {
		
		// Generar (idempotente por índice único)
		await RecurringTaskService.generateTasksForMonth(year, month, user.id)

		// // Actualizar tareas vencidas en la BD antes de consultar
		// await this.markExpiredTasks();

		// Calculate date range for the month (include days from prev/next month visible in calendar)
		const startDate = new Date(Date.UTC(year, month - 1, 1));
		startDate.setUTCDate(startDate.getUTCDate() - 7); // Include prev month days
		
		const endDate = new Date(Date.UTC(year, month, 0)); // Last day of month
		endDate.setUTCDate(endDate.getUTCDate() + 7); // Include next month days
		endDate.setUTCHours(23, 59, 59, 999);

		let query = {
			deadline: { $gte: startDate, $lte: endDate }
		};

		if (user.isSupervisor) {
			// Supervisor: get all tasks from users in the same sector
			const { UserModel } = await import("../model/User.js");
			const usersInSector = await UserModel.find({ sector: user.sector }).select("_id");
			const userIds = usersInSector.map(u => u._id);
			
			query.assignedTo = { $in: userIds };
		} else {
			// Regular user: only tasks where they are assigned
			query.assignedTo = user.id;
		}

		const tasks = await TaskModel.find(query)
			.populate("assignedTo", "name email")
			.sort({ deadline: 1 })
			.lean();

		return tasks;
	},
};
