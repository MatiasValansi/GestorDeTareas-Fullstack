import { MongoUserRepository } from "../repository/user.mongo.repository.js";
import { UserService } from "../services/user.service.js";

const mongoUser = new MongoUserRepository();

export const UserController = {
	userAll: async (req, res) => {
		const users = await mongoUser.getAll();

		if (users.length == 0) {
			res.status(404).json({
				payload: null,
				message: "No se encontró ninguna tarea",
				ok: false,
			});
			return;
		}

		res.status(200).json({
			message: "Success ---> Las tareas fueron halladas correctamente",
			payload: users,
			ok: true,
		});
	},

	userValidation: async (req, res) => {
		const { id } = req.params;
		//const userFoundById = await UserService.serviceUserValidation(id);
		const userFoundById = await mongoUser.getById(id);

		if (!userFoundById) {
			res.status(404).json({
				payload: null,
				message: "El usuario no fue hallado",
				ok: false,
			});
			return null;
		} else {
			res.status(200).json({
				message: "Success --> El usuario fue hallado",
				payload: { userFoundById },
				ok: true,
			});
		}
	},

	userCreateOne: async (req, res) => {
		const { user } = req.body;

		try {
			//const userResponse = await UserService.serviceUserCreation(user);
			const userResponse = await mongoUser.createOne(user);

			res.status(200).json({
				message: "Success --> El usuario ha sido creado",
				payload: { ...userResponse, usuario: userResponse.fullname },
				ok: true,
			});
			return;
		} catch (e) {
			console.log({ error: e.message, mensaje: "Algo salió mal" });
			res.status(404).json({
				payload: null,
				message: "No se pudo crear el usuario",
				ok: false,
			});
			return;
		}
	},

	userDeleteOne: async (req, res) => {
		const { id } = req.params;
		//const userDeleted = await UserService.serviceUserDelete(id);
		const userDeleted = await mongoUser.deleteOne(id);

		if (!userDeleted) {
			res.status(404).json({
				payload: null,
				message: `No se pudo eliminar el usuario con el id: ${id}`,
				ok: false,
			});
			return;
		}

		res.status(200).json({
			message: `Success: El usuario "${userDeleted.name}" fue eliminado`,
			payload: { userDeleted },
			ok: true,
		});
		return;
	},

	userUpdateOne: async (req, res) => {
		const { id } = req.params;
		const { name, email } = req.body;

		/*
		const userUpdated = await UserService.serviceUserUpdate(
			id,
			fullname,
			email,
		);
		*/
		const userUpdated = await mongoUser.updateOne(id, { name, email });

		if (!userUpdated) {
			res.status(404).json({
				payload: null,
				message: `No se puede actualizar el usuario con el id: ${id}`,
				ok: false,
			});
			return;
		}

		res.status(200).json({
			message: "Usuario Actualizado",
			payload: userUpdated,
			ok: true,
		});
		return;
	},
};
