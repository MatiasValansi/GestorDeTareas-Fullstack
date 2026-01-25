import mongoConnectionInstance from "./src/database/mongoose.database.js";
import { UserModel } from "./src/model/User.js";

const DEFAULTS = {
	email: "supervisor@test.com",
	password: "123456",
	name: "Supervisor Test",
	sector: "TECNOLOGIA_INFORMATICA",
	isSupervisor: true,
};

const getArg = (flag) => {
	const index = process.argv.indexOf(flag);
	if (index === -1) return undefined;
	return process.argv[index + 1];
};

const params = {
	email: getArg("--email") || DEFAULTS.email,
	password: getArg("--password") || DEFAULTS.password,
	name: getArg("--name") || DEFAULTS.name,
	sector: getArg("--sector") || DEFAULTS.sector,
	isSupervisor:
		(getArg("--isSupervisor")
			? getArg("--isSupervisor") === "true"
			: DEFAULTS.isSupervisor) ?? true,
};

if (!params.email || !params.password || !params.name || !params.sector) {
	console.error(
		"Uso: node createSupervisor.js [--email x] [--password x] [--name x] [--sector x] [--isSupervisor true|false]",
	);
	process.exit(1);
}

try {
	await mongoConnectionInstance.connect();

	const email = params.email.trim().toLowerCase();
	let user = await UserModel.findOne({ email }).exec();

	if (!user) {
		user = new UserModel({
			name: params.name,
			email,
			password: params.password,
			sector: params.sector,
			isSupervisor: Boolean(params.isSupervisor),
		});
		await user.save();
		console.log("Supervisor creado:", {
			id: user._id.toString(),
			email: user.email,
			sector: user.sector,
			isSupervisor: user.isSupervisor,
		});
		process.exit(0);
	}

	user.name = params.name;
	user.sector = params.sector;
	user.isSupervisor = Boolean(params.isSupervisor);
	user.password = params.password; // re-hash por pre-save hook
	await user.save();

	console.log("Supervisor actualizado:", {
		id: user._id.toString(),
		email: user.email,
		sector: user.sector,
		isSupervisor: user.isSupervisor,
	});
	process.exit(0);
} catch (error) {
	console.error("No se pudo crear/actualizar el supervisor:", error);
	process.exit(1);
}
