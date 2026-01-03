import dotenv from "dotenv";
import mongoose from "mongoose";
import mongoConnectionInstance from "../database/mongoose.database.js";
import { UserModel } from "../model/User.js";
import { RecurringTaskModel } from "../model/RecurringTask.js";
import { RecurringTaskRepository } from "../repository/recurring.task.repository.js";

dotenv.config();

let testUser;

beforeAll(async () => {
  // Conectar a la misma base que usa la app
  await mongoConnectionInstance.connect();

  // Limpiar datos de pruebas anteriores
  await UserModel.deleteMany({ email: /@recurring-test\.local$/ }).exec();
  await RecurringTaskModel.deleteMany({ title: /Recurring Test/ }).exec();

  // Crear un usuario para asignar las tareas recurrentes
  testUser = await UserModel.create({
    name: "Recurring Test User",
    email: "user@recurring-test.local",
    password: "123456",
    sector: "TECNOLOGIA_INFORMATICA",
    isSupervisor: true,
  });
});

afterAll(async () => {
  await RecurringTaskModel.deleteMany({ title: /Recurring Test/ }).exec();
  await UserModel.deleteMany({ email: /@recurring-test\.local$/ }).exec();
  await mongoose.disconnect();
});

describe("RecurringTaskRepository", () => {
  test("create() y getById() deben crear y recuperar una tarea recurrente", async () => {
    const startingFrom = new Date();

    const data = {
      title: "Recurring Test - Diario",
      description: "Tarea recurrente de prueba",
      assignedTo: [testUser._id],
      periodicity: "DIARIA",
      startingFrom,
      active: true,
    };

    const created = await RecurringTaskRepository.create(data);

    expect(created).toBeDefined();
    expect(created._id).toBeDefined();
    expect(created.title).toBe(data.title);
    expect(created.assignedTo).toHaveLength(1);

    const found = await RecurringTaskRepository.getById(created._id);

    expect(found).not.toBeNull();
    expect(found.title).toBe(data.title);
    expect(found.assignedTo[0]._id.toString()).toBe(testUser._id.toString());
  });

  test("getAllActive() solo devuelve tareas activas", async () => {
    const baseData = {
      assignedTo: [testUser._id],
      periodicity: "SEMANAL",
      datePattern: "LUNES",
      startingFrom: new Date(),
    };

    await RecurringTaskRepository.create({
      ...baseData,
      title: "Recurring Test - Activa",
      description: "Activa",
      active: true,
    });

    await RecurringTaskRepository.create({
      ...baseData,
      title: "Recurring Test - Inactiva",
      description: "Inactiva",
      active: false,
    });

    const allActive = await RecurringTaskRepository.getAllActive();

    expect(Array.isArray(allActive)).toBe(true);
    expect(allActive.length).toBeGreaterThan(0);
    allActive.forEach((task) => {
      expect(task.active).toBe(true);
    });
  });

  test("updateById() solo actualiza title y description y ejecuta callback", async () => {
    const startingFrom = new Date();

    const created = await RecurringTaskRepository.create({
      title: "Recurring Test - Update",
      description: "Descripción original",
      assignedTo: [testUser._id],
      periodicity: "MENSUAL",
      numberPattern: 1,
      startingFrom,
      active: true,
    });

    const onUpdate = jest.fn();

    const updated = await RecurringTaskRepository.updateById(
      created._id,
      {
        title: "Recurring Test - Update (modificada)",
        description: "Descripción modificada",
        active: false, // no debería cambiarse por la lógica del repo
      },
      onUpdate,
    );

    expect(updated).not.toBeNull();
    expect(updated.title).toBe("Recurring Test - Update (modificada)");
    expect(updated.description).toBe("Descripción modificada");
    expect(updated.active).toBe(true); // sigue siendo true porque no se permite actualizarlo

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(created._id, {
      title: "Recurring Test - Update (modificada)",
      description: "Descripción modificada",
    });
  });

  test("deleteById() elimina la tarea recurrente", async () => {
    const task = await RecurringTaskRepository.create({
      title: "Recurring Test - Delete",
      description: "Para borrar",
      assignedTo: [testUser._id],
      periodicity: "DIARIA",
      startingFrom: new Date(),
      active: true,
    });

    const deleted = await RecurringTaskRepository.deleteById(task._id);
    expect(deleted).not.toBeNull();

    const found = await RecurringTaskRepository.getById(task._id);
    expect(found).toBeNull();
  });
});
