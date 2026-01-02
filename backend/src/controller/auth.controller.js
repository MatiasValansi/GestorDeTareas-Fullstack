import bcrypt from "bcrypt";
import { MongoUserRepository } from "../repository/user.mongo.repository.js";
import { userToken } from "../utils/jwt.token.js";

const mongoUser = new MongoUserRepository();

const buildUserResponse = (userDoc) => ({
	id: userDoc._id,
	name: userDoc.name,
	email: userDoc.email,
	sector: userDoc.sector,
	isSupervisor: userDoc.isSupervisor,
});

export const AuthController = {
	// POST /auth/login
	// body: { email, password }
	login: async (req, res) => {
		try {
			const { email, password } = req.body || {};

			if (!email || !password) {
				return res
					.status(400)
					.json({ error: "Email y password son requeridos" });
			}

			const user = await mongoUser.getByEmailWithPassword(email);

			if (!user) {
				return res
					.status(401)
					.json({ error: "Credenciales inválidas" });
			}

			const isPasswordValid = await bcrypt.compare(password, user.password);

			if (!isPasswordValid) {
				return res
					.status(401)
					.json({ error: "Credenciales inválidas" });
			}

			// Payload mínimo y seguro
			const payload = {
				sub: user._id.toString(),
				email: user.email,
				isSupervisor: user.isSupervisor,
				sector: user.sector,
			};

			const token = userToken(payload);
			const safeUser = buildUserResponse(user);

			return res.status(200).json({ token, user: safeUser });
		} catch (error) {
			console.error("Error en /auth/login", error);
			return res
				.status(500)
				.json({ error: "Error interno al intentar iniciar sesión" });
		}
	},

	// GET /auth/me
	// Requiere authByToken
	me: async (req, res) => {
		try {
			if (req.authUser) {
				return res.status(200).json({
					user: buildUserResponse(req.authUser),
				});
			}

			if (!req.user || !req.user.id) {
				return res
					.status(401)
					.json({ error: "Usuario no autenticado" });
			}

			const user = await mongoUser.getById(req.user.id);
			if (!user) {
				return res
					.status(404)
					.json({ error: "Usuario no encontrado" });
			}

			return res.status(200).json({ user: buildUserResponse(user) });
		} catch (error) {
			console.error("Error en /auth/me", error);
			return res
				.status(500)
				.json({ error: "Error interno al obtener el perfil" });
		}
	},
};
