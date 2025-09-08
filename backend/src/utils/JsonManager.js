import fs from "node:fs/promises";

export const JsonHandler = {
	async read(DB_PATH) {
		try {
			const data = await fs.readFile(DB_PATH, { encoding: "utf8" });
			return JSON.parse(data || []);
		} catch (error) {
			console.error("Error leyendo el archivo:", error);
		}
	},

	async write(data, DB_PATH) {
		try {
			const strData = JSON.stringify(data, null, 2);
			await fs.writeFile(DB_PATH, strData, { encoding: "utf8" });
		} catch (error) {
			console.log({ error });
		}
	},
};
