import { UserModel } from "../model/User.js";

export class MongoUserRepository {
	async count() {
		return await UserModel.countDocuments({}).exec();
	}

	async getAll() {
		return await UserModel.find().exec();
	}

	async getById(id) {
		return await UserModel.findById(id)
			// .populate("tasks", "title description date assignedTo")
			.exec();
	}

	async createOne(user) {
		const createdUser = new UserModel(user);
		return await createdUser.save();
	}

	async getByEmailWithPassword(email) {
		// Incluye el campo password (select: false por defecto) para el login
		return await UserModel.findOne({ email }).select("+password").exec();
	}

	async getByEmail(email) {
		return await UserModel.findOne({ email }).exec();
	}

	async updateOne(id, updateUserData) {
		return await UserModel.findByIdAndUpdate(id, updateUserData, {
			new: true,
		}).exec();
	}
	async deleteOne(id) {
		const is_deleted = UserModel.findByIdAndDelete(id).exec();
		return is_deleted;
	}

	async getBySector(sector) {
		return await UserModel.find({ sector }).exec();
	}

	async getUserEmail(id) {
		const user = await UserModel.findById(id).exec();
		return user ? user.email : null;
	}

	async getUsersEmails(ids) {
  const users = await UserModel.find({
    _id: { $in: ids },
  }).select("email");

  return users
    .map(u => u.email)
    .filter(Boolean);
}
}
