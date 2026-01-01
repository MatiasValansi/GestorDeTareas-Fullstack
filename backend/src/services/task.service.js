import { TaskModel } from "../model/Task.js";
import { TaskRepository } from "../repository/task.repository.js";

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

	serviceTaskDelete: (id) => {
		const idTask = TaskRepository.deleteById(id);

		if (!idTask) return null;
		return idTask;
	},

	serviceTaskUpdate: async (id, title, description) => {
		const taskUpdated = await TaskRepository.updateById(id, title, description);

		if (!taskUpdated) return null;

		return taskUpdated;
	},

	serviceTaskGetAll: () => {
		const tasks = TaskRepository.getAll();

		if (!tasks) return null;

		return tasks;
	},

	async markExpiredTasks() {
		const now = new Date();
		await TaskModel.updateMany(
			{
				status: { $ne: "COMPLETADA" },
				deadline: { $lt: now },
			},
			{
				$set: { status: "VENCIDA" },
			},
		);
	},

	async getTasksBetween(from, to, userIds) {
		await this.markExpiredTasks();

		return TaskModel.find({
			assignedTo: { $in: userIds },
			deadline: { $gte: from, $lte: to },
		});
	},
};
