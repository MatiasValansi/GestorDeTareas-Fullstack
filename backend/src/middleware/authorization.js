import { MongoUserRepository } from "../repository/user.mongo.repository.js";

const mongoUser = new MongoUserRepository();

// Requiere que el usuario autenticado sea supervisor
export const requireSupervisor = (req, res, next) => {
	if (!req.user || !req.user.isSupervisor) {
		return res
			.status(403)
			.json({ error: "Requiere rol de supervisor" });
	}

	return next();
};

// Requiere que el usuario del path param :id pertenezca
// al mismo sector que el usuario autenticado
export const requireSameSectorForUserParam = async (req, res, next) => {
	try {
		if (!req.user || !req.user.sector) {
			return res
				.status(401)
				.json({ error: "Usuario no autenticado o sin sector" });
		}

		const { id } = req.params;
		const targetUser = await mongoUser.getById(id);

		if (!targetUser) {
			return res.status(404).json({ error: "Usuario destino no encontrado" });
		}

		if (targetUser.sector !== req.user.sector) {
			return res.status(403).json({
				error: "No tiene permisos para operar sobre usuarios de otro sector",
			});
		}

		return next();
	} catch (error) {
		console.error("Error en requireSameSectorForUserParam", error);
		return res
			.status(500)
			.json({ error: "Error interno en validación de sector" });
	}
};
