import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import { MongoUserRepository } from "../repository/user.mongo.repository.js";

const mongoUser = new MongoUserRepository();

// Middleware de autenticación por JWT
// - Lee Authorization: Bearer <token>
// - Verifica y adjunta payload mínimo en req.user
// - Opcionalmente adjunta el usuario real de DB en req.authUser
export const authByToken = async (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ error: "Token no proporcionado o con formato inválido" });
	}

	const token = authHeader.split(" ")[1]; // formato: "Bearer <token>"

	try {
		const decoded = jwt.verify(token, config.SECRET_KEY);

		// Normalizamos el payload que se expone en req.user
		const userId = decoded.sub || decoded.id || decoded._id;
		req.user = {
			id: userId,
			email: decoded.email,
			isSupervisor: decoded.isSupervisor,
			sector: decoded.sector,
		};

		// Mejor práctica opcional: adjuntar el usuario actual desde DB
		// Esto permite reflejar cambios de rol/sector posteriores al login
		if (userId) {
			const dbUser = await mongoUser.getById(userId);
			if (!dbUser) {
				return res.status(401).json({ error: "Usuario autenticado no encontrado" });
			}
			// Documento completo de Mongoose (password sigue oculto por select:false)
			req.authUser = dbUser;
		}

		return next();
	} catch (err) {
		return res.status(401).json({ error: "Token inválido o expirado" });
	}
};
