import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import mongoConnectionInstance from "../database/mongoose.database.js";
import { UserModel } from "../model/User.js";

dotenv.config();

beforeAll(async () => {
	await mongoConnectionInstance.connect();
	// Limpiamos usuarios de pruebas anteriores
	await UserModel.deleteMany({ email: /@test\.local$/ }).exec();
	// Creamos un usuario supervisor para usar en el login
	await UserModel.create({
		name: "Supervisor Test",
		email: "supervisor@test.local",
		password: "123456",
		sector: "TECNOLOGIA_INFORMATICA",
		isSupervisor: true,
	});
});

afterAll(async () => {
	await UserModel.deleteMany({ email: /@test\.local$/ }).exec();
	await mongoose.disconnect();
});

describe("Pruebas unitarias de Users", () => {
	let createdUser;
	let authToken;

	test("LOGIN /auth/login -> obtener token de supervisor", async () => {
		const loginResponse = await request(app)
			.post("/auth/login")
			.send({
				email: "supervisor@test.local",
				password: "123456",
			});

		expect(loginResponse.statusCode).toBe(200);
		expect(loginResponse.body).toHaveProperty("token");
		expect(loginResponse.body).toHaveProperty("user");

		authToken = loginResponse.body.token;
	});

	test("POST /users/user -> crear un usuario con supervisor autenticado", async () => {
		const response = await request(app)
			.post("/users/user")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				user: {
					name: "Usuario Test",
					email: "usuario@test.local",
					password: "123456",
					sector: "TECNOLOGIA_INFORMATICA",
					isSupervisor: false,
				},
			});

		expect(response.statusCode).toBe(200);
		expect(response.body).toHaveProperty("payload");

		const user = response.body.payload._doc || response.body.payload;

		expect(user).toHaveProperty("_id");
		expect(user.name).toBe("Usuario Test");
		expect(user.email).toBe("usuario@test.local");

		createdUser = response.body;
	});
});
