import { config } from "./config/config.js";
import mongoConnectionInstance from "./database/mongoose.database.js";
import app from "./app.js";

const startServer = async () => {
	try {
		await mongoConnectionInstance.connect();
		app.listen(config.PORT, () => {
			console.log(
				`🫶🏻⚽🍕 Server is Running in http://${config.HOST}:${config.PORT} 😎🍔💪🏻`,
			);
		});
	} catch (e) {
		console.error("Server is not running properly.");
		console.error(e);
		console.log("URI:", config.MONGODB_URI);
	console.log("Tipo:", typeof config.MONGODB_URI);
	}
};

startServer();