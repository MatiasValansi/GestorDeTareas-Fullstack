import { MongoUserRepository } from "../repository/user.mongo.repository.js";
import { UserService } from "../services/user.service.js";

const mongoUser = new MongoUserRepository();

export const UserController = {
	userAll: async (req, res) => {
		try {
			const users = await mongoUser.getAll();
			// Devolver array vacío con 200 OK es mejor práctica REST que 404
			return res.status(200).json({
				message: users.length > 0 
					? "Success ---> Los usuarios fueron hallados correctamente" 
					: "No hay usuarios registrados",
				payload: users || [],
				ok: true,
			});
		} catch (error) {
			console.error("Error al obtener usuarios:", error);
			return res.status(500).json({
				payload: null,
				message: error.message,
				ok: false,
			});
		}
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
		const creatorUser = req.user; // Usuario supervisor que está creando

		try {
			// Si el endpoint se llama sin JWT, permitimos bootstrap SOLO si la BD está vacía
			// (caso típico: borraron todos los usuarios y no se puede iniciar sesión).
			if (!creatorUser) {
				const totalUsers = await mongoUser.count();
				if (totalUsers > 0) {
					return res.status(401).json({
						payload: null,
						message: "Requiere autenticación para crear usuarios",
						ok: false,
					});
				}
			}

			// Validaciones de seguridad
			if (!user || !user.name || !user.email || !user.password) {
				return res.status(400).json({
					payload: null,
					message: "Nombre, email y contraseña son requeridos",
					ok: false,
				});
			}

			// Validar longitud mínima de contraseña
			if (user.password.length < 6) {
				return res.status(400).json({
					payload: null,
					message: "La contraseña debe tener al menos 6 caracteres",
					ok: false,
				});
			}

			// Verificar que el email no exista
			const existingUser = await mongoUser.getByEmail(user.email);
			if (existingUser) {
				return res.status(409).json({
					payload: null,
					message: "Ya existe un usuario con ese email",
					ok: false,
				});
			}

			// Construir datos del usuario con sector del supervisor creador
			// El password se hashea automáticamente en el modelo (pre-save hook)
			const sectorToUse = creatorUser?.sector || user.sector;
			if (!sectorToUse) {
				return res.status(400).json({
					payload: null,
					message:
						"El sector es requerido (en bootstrap envíalo como user.sector)",
					ok: false,
				});
			}

			const userData = {
				name: user.name.trim(),
				email: user.email.trim().toLowerCase(),
				password: user.password, // Se hashea en el modelo con bcrypt
				sector: sectorToUse, // Mismo sector que el supervisor (o bootstrap)
				isSupervisor: Boolean(user.isSupervisor), // false por defecto
			};

			const userResponse = await mongoUser.createOne(userData);

			// Respuesta sin exponer el password
			const safeResponse = {
				id: userResponse._id,
				name: userResponse.name,
				email: userResponse.email,
				sector: userResponse.sector,
				isSupervisor: userResponse.isSupervisor,
			};

			res.status(201).json({
				message: "Success --> El usuario ha sido creado",
				payload: safeResponse,
				ok: true,
			});
			return;
		} catch (e) {
			console.error("Error al crear usuario:", e.message);
			
			// Manejar error de duplicado de MongoDB
			if (e.code === 11000) {
				return res.status(409).json({
					payload: null,
					message: "Ya existe un usuario con ese email",
					ok: false,
				});
			}

			res.status(500).json({
				payload: null,
				message: e.message || "No se pudo crear el usuario",
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

	// Obtener usuarios del mismo sector (accesible para cualquier usuario autenticado)
	usersBySector: async (req, res) => {
		const sector = req.user?.sector;
		
		if (!sector) {
			res.status(400).json({
				payload: null,
				message: "No se pudo determinar el sector del usuario",
				ok: false,
			});
			return;
		}

		try {
			const users = await mongoUser.getBySector(sector);

			res.status(200).json({
				message: "Success --> Usuarios del sector encontrados",
				payload: users,
				ok: true,
			});
		} catch (error) {
			res.status(500).json({
				payload: null,
				message: "Error al obtener usuarios del sector",
				ok: false,
			});
		}
	},
};
