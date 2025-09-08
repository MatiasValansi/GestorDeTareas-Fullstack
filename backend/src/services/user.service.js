import { UserModel } from "../model/User.js";
import { TaskRepository } from "../repository/task.repository.js";
import { UserRepository } from "../repository/user.repository.js";

export const UserService = {
	serviceUserValidation: async (id) => {
		const idUser = await UserRepository.getById(id);

		if (!idUser) return null;

		return idUser;
	},

	serviceUserCreation: async (userToCreate) => {
		const dataUser = {
			...userToCreate,
			id: crypto.randomUUID().toString(),
		};

		const modelUserToCreate = new UserModel(
			dataUser.id,
			dataUser.fullname,
			dataUser.email,
		);

		const userCreated = await UserRepository.createOne(modelUserToCreate);

		return userCreated;
	},

	serviceUserDelete: (id) => {
		const idUser = UserRepository.deleteById(id);

		if (!idUser) return null;

		return idUser;
	},

	serviceUserUpdate: async (id, fullname, mail) => {
		const userUpdated = await UserRepository.updateById(id, fullname, mail);

		if (!userUpdated) return null;

		return userUpdated;
	},

	serviceUserGetAll: () => {
		const users = TaskRepository.getAll();

		if (!users) return null;

		return users;
	},
};
