import { Router } from "express";

const statusRouter = Router();

statusRouter.get("/v01/status", (req, res) => {
	res.json({
		status: 200,
		timeStatus: new Date().toISOString(),
		message: "1...2..3...4...probando",
	});
});

statusRouter.get("/v02/status", (req, res) => {
	res.json({
		status: 200,
		timeStatus: new Date().toISOString(),
		message: "Funcioan correctamente !!! 🤫🤫🤫",
	});
});

export { statusRouter };
