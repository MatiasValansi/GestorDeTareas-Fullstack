import { config } from "../config/config.js";
import { JsonHandler } from "../utils/JsonManager.js";

export const TaskRepository = {
	getById: async (id) => {
		const tasks = await JsonHandler.read(config.DB_PATH_TASK);

		if (!tasks) return null;

		const taskExists = tasks.find((task) => task.id == id);

		if (!taskExists) return null;

		return taskExists;
	},

	getAll: async () => await JsonHandler.read(config.DB_PATH_USER),

	createOne: async (taskToCreate) => {
		const tasks = await JsonHandler.read(config.DB_PATH_TASK);

		if (!tasks) return null;

		tasks.push(taskToCreate);

		try {
			await JsonHandler.write(tasks, config.DB_PATH_TASK);
		} catch (e) {
			console.error({ message: e.message });
		}

		return taskToCreate;
	},

	deleteById: async (id) => {
		const tasks = await JsonHandler.read(config.DB_PATH_TASK);

		if (!tasks) return null;

		const taskToDeleteExists = tasks.find((eachTask) => eachTask.id == id);

		if (!taskToDeleteExists) return null;

		const tasksToSaveAgain = tasks.filter((eachTask) => eachTask.id != id);

		try {
			await JsonHandler.write(tasksToSaveAgain, config.DB_PATH_TASK);
			return taskToDeleteExists;
		} catch (error) {
			console.error(`No se ha podido eliminar ---> ${error.message}`);
			return null;
		}
	},

	updateById: async (id, title, description) => {
		const tasks = await JsonHandler.read(config.DB_PATH_TASK);

		if (!tasks) return null;

		const taskToUpdateExists = tasks.find((eachTask) => eachTask.id == id);

		if (!taskToUpdateExists) return null;

		const tasksToSaveAgain = tasks.filter((eachTask) => eachTask.id != id);

		const taskUpdated = {
			...taskToUpdateExists,
			title: title,
			description: description,
		};

		tasksToSaveAgain.push(taskUpdated);

		try {
			await JsonHandler.write(tasksToSaveAgain, config.DB_PATH_TASK);
			return taskUpdated;
		} catch (error) {
			console.error(`No se ha podido actualizar ---> ${error.message}`);
			return null;
		}
	},
};
