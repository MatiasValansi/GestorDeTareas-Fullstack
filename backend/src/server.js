import app from "./app.js";
import { config } from "./config/config.js";
import mongoConnectionInstance from "./database/mongoose.database.js";

const PORT = process.env.PORT || config.PORT || 3000;
const HOST = "0.0.0.0";

const startServer = async () => {
  try {
    await mongoConnectionInstance.connect();

    app.listen(PORT, HOST, () => {
      console.log(`✅ Server listening on ${HOST}:${PORT}`)
	  console.log(
				`🫶🏻⚽🍕 Server is Running in http://${config.HOST}:${config.PORT} 😎🍔💪🏻`,
			);
    });
  } catch (e) {
    console.error("❌ Server failed to start.");
    console.error(e);
  }
};

startServer();
