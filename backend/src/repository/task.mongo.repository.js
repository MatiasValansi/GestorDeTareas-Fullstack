import { TaskModel } from "../model/Task.js";

export class MongoTaskRepository {
	async getAll() {
		return await TaskModel.find().exec();
	}

	async getById(id) {
		return await TaskModel.findById(id).populate("assignedTo", "name email")
			.exec();
	}

	async createOne(task) {
		const createTask = new TaskModel(task);
		return await createTask.save();
	}

	async updateOne(id, updateUserData) {
		return await TaskModel.findByIdAndUpdate(id, updateUserData, {
			new: true,
		}).exec();
	}
	async deleteOne(id) {
		const is_deleted = TaskModel.findByIdAndDelete(id).exec();
		return is_deleted != null;
	}
}
