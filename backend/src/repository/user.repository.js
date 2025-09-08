import { config } from "../config/config.js";
import { JsonHandler } from "../utils/JsonManager.js";

export const UserRepository = {
	getById: async (id) => {
		const users = await JsonHandler.read(config.DB_PATH_USER);

		if (!users) return null;

		const userExists = users.find((eachUser) => eachUser.id == id);

		if (!userExists) return null;

		return userExists;
	},

	getAll: async () => await JsonHandler.read(config.DB_PATH_USER),

	createOne: async (userToCreate) => {
		const users = await JsonHandler.read(config.DB_PATH_USER);

		if (!users) return null;

		//Podría validar que si existe un USER con el mismo ID, no lo añada
		users.push(userToCreate);

		try {
			await JsonHandler.write(users, config.DB_PATH_USER);
		} catch (e) {
			console.error({ message: e.message });
		}

		return userToCreate;
	},

	deleteById: async (id) => {
		const users = await JsonHandler.read(config.DB_PATH_USER);

		if (!users) return null;

		const userToDeleteExists = users.find((eachUser) => eachUser.id == id);

		if (!userToDeleteExists) return null;

		const usersToSaveAgain = users.filter((eachUser) => eachUser.id != id);

		try {
			await JsonHandler.write(usersToSaveAgain, config.DB_PATH_USER);
			return userToDeleteExists;
		} catch (error) {
			console.error(`No se ha podido eliminar ---> ${error.message}`);
			return null;
		}
	},

	updateById: async (id, fullname, email) => {
		const users = await JsonHandler.read(config.DB_PATH_USER);

		if (!users) return null;

		const userToUpdateExists = users.find((eachUser) => eachUser.id == id);

		if (!userToUpdateExists) return null;

		const usersToSaveAgain = users.filter((eachUser) => eachUser.id != id);

		const userUpdated = {
			...userToUpdateExists,
			fullname: fullname,
			email: email,
		};

		usersToSaveAgain.push(userUpdated);

		try {
			await JsonHandler.write(usersToSaveAgain, config.DB_PATH_USER);
			return userUpdated;
		} catch (error) {
			console.error(`No se ha podido actualizar ---> ${error.message}`);
			return null;
		}
	},
};
