import { RecurringTaskModel } from "../model/RecurringTask.js";

export const RecurringTaskRepository = {
	/**
	 * Creates a new recurring task in the database
	 * @param {Object} recurringTaskData - The recurring task data
	 * @returns {Promise<Document>} The created recurring task
	 */
	async create(recurringTaskData) {
		const recurringTask = new RecurringTaskModel(recurringTaskData);
		return await recurringTask.save();
	},

	/**
	 * Finds a recurring task by its MongoDB ObjectId
	 * @param {string} id - The MongoDB ObjectId
	 * @returns {Promise<Document|null>} The found recurring task or null
	 */
	async getById(id) {
		return await RecurringTaskModel.findById(id).populate("assignedTo");
	},

	/**
	 * Gets all recurring tasks
	 * @returns {Promise<Document[]>} Array of all recurring tasks
	 */
	async getAll() {
		return await RecurringTaskModel.find().populate("assignedTo");
	},

	/**
	 * Gets all recurring tasks assigned to a specific user
	 * @param {string} userId - The user ID to filter by
	 * @returns {Promise<Document[]>} Array of recurring tasks assigned to the user
	 */
	async getByAssignedUser(userId) {
		return await RecurringTaskModel.find({ assignedTo: userId }).populate("assignedTo");
	},

	/**
	 * Gets all recurring tasks where any assigned user belongs to a specific sector
	 * @param {string} sector - The sector to filter by
	 * @returns {Promise<Document[]>} Array of recurring tasks with users from the sector
	 */
	async getBySector(sector) {
		// First get all tasks with populated users, then filter by sector
		const allTasks = await RecurringTaskModel.find().populate("assignedTo");
		return allTasks.filter(task => 
			task.assignedTo.some(user => user.sector === sector)
		);
	},

	/**
	 * Gets all active recurring tasks
	 * @returns {Promise<Document[]>} Array of active recurring tasks
	 */
	async getAllActive() {
		return await RecurringTaskModel.find({ active: true }).populate("assignedTo");
	},

	/**
	 * Updates a recurring task by its MongoDB ObjectId
	 * @param {string} id - The MongoDB ObjectId
	 * @param {Object} updateData - The data to update (title, description, assignedTo)
	 * @param {Function} onUpdateCallback - Callback to handle individual tasks update
	 * @returns {Promise<Document|null>} The updated recurring task or null
	 */
	async updateById(id, updateData, onUpdateCallback) {
		// Allow title, description, assignedTo, active, and deactivatedAt updates
		const allowedUpdates = {};
		if (updateData.title !== undefined) allowedUpdates.title = updateData.title;
		if (updateData.description !== undefined) allowedUpdates.description = updateData.description;
		if (updateData.assignedTo !== undefined) allowedUpdates.assignedTo = updateData.assignedTo;
		if (updateData.active !== undefined) allowedUpdates.active = updateData.active;
		if (updateData.deactivatedAt !== undefined) allowedUpdates.deactivatedAt = updateData.deactivatedAt;

		const updatedRecurringTask = await RecurringTaskModel.findByIdAndUpdate(
			id,
			{ $set: allowedUpdates },
			{ new: true, runValidators: true }
		).populate("assignedTo");

		if (updatedRecurringTask && onUpdateCallback) {
			await onUpdateCallback(id, allowedUpdates);
		}

		return updatedRecurringTask;
	},

	/**
	 * Deletes a recurring task by its MongoDB ObjectId
	 * @param {string} id - The MongoDB ObjectId
	 * @returns {Promise<Document|null>} The deleted recurring task or null
	 */
	async deleteById(id) {
		return await RecurringTaskModel.findByIdAndDelete(id);
	},
};
