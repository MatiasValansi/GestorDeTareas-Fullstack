import { TaskModel } from "../model/Task.js";

/**
 * MongoTaskRepository - Capa de persistencia para tareas
 * 
 * Responsabilidades:
 * - SOLO operaciones de base de datos (CRUD)
 * - NO contiene lógica de negocio
 * - NO valida reglas de negocio
 * 
 * Principios Clean Architecture:
 * - El Repository NO conoce HTTP
 * - El Repository NO toma decisiones de negocio
 * - El Repository solo traduce llamadas a operaciones MongoDB
 */
export class MongoTaskRepository {
	/**
	 * Obtiene todas las tareas
	 * @returns {Promise<Array>} Lista de tareas
	 */
	async getAll() {
		return await TaskModel.find()
			.populate("assignedTo", "name email")
			.exec();
	}

	/**
	 * Obtiene una tarea por ID
	 * @param {string} id - ID de MongoDB
	 * @returns {Promise<Object|null>} Tarea o null
	 */
	async getById(id) {
		return await TaskModel.findById(id)
			.populate("assignedTo", "name email")
			.exec();
	}

	/**
	 * Crea una nueva tarea
	 * @param {Object} task - Datos de la tarea
	 * @returns {Promise<Object>} Tarea creada
	 */
	async createOne(task) {
		const createTask = new TaskModel(task);
		return await createTask.save();
	}

	/**
	 * Actualiza una tarea
	 * @param {string} id - ID de MongoDB
	 * @param {Object} updateData - Datos a actualizar
	 * @returns {Promise<Object|null>} Tarea actualizada o null
	 */
	async updateOne(id, updateData) {
		return await TaskModel.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true, runValidators: true }
		)
			.populate("assignedTo", "name email")
			.exec();
	}

	/**
	 * Elimina una tarea
	 * @param {string} id - ID de MongoDB
	 * @returns {Promise<boolean>} true si se eliminó
	 */
	async deleteOne(id) {
		const deleted = await TaskModel.findByIdAndDelete(id).exec();
		return deleted != null;
	}

	/**
	 * Obtiene tareas en un rango de fechas para ciertos usuarios
	 * @param {Date} startDate - Fecha inicio
	 * @param {Date} endDate - Fecha fin
	 * @param {Array} userIds - IDs de usuarios
	 * @returns {Promise<Array>} Tareas encontradas
	 */
	async getByDateRangeAndUsers(startDate, endDate, userIds) {
		return await TaskModel.find({
			date: { $gte: startDate, $lte: endDate },
			assignedTo: { $in: userIds },
		})
			.populate("assignedTo", "name email")
			.sort({ date: 1 })
			.lean();
	}

	/**
	 * Marca tareas vencidas como VENCIDA
	 * @param {Date} now - Fecha actual para comparar
	 * @returns {Promise<Object>} Resultado con modifiedCount
	 */
	async markExpiredTasks(now) {
		return await TaskModel.updateMany(
			{
				status: "PENDIENTE",
				deadline: { $lt: now },
			},
			{
				$set: { status: "VENCIDA" },
			}
		);
	}
}
