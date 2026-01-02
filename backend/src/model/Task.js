// export class Task {
//   constructor(id, title, description, userId, status = "pending") {
//     this.id = id; // string o número único
//     this.title = title; // título de la tarea
//     this.description = description; // descripción opcional
//     this.userId = userId; // id del usuario asignado
//     this.status = status; // estado inicial (pending, completed, etc.)
//   }
// }
//prueba
import mongoose, { Schema } from "mongoose";

const TASK_STATUS = ["PENDIENTE", "COMPLETADA", "VENCIDA"];

const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		deadline: {
			type: Date,
			required: true,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		//Establecemos la relación entre Task y User (1 a 1..n)
		assignedTo: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: "User",
				},
				
			],
			// Requerimos al menos una asignación (array no nulo)
			required: true,
		},
		status: {
			type: String,
			enum: TASK_STATUS,
			default: "PENDIENTE",
			required: true,
			index: true,
		},
		recurringTaskId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "RecurringTask",
			default: null,
		},
	},
	{
		timestamps: true,
	},
);

taskSchema.index(
	{ recurringTaskId: 1, assignedTo: 1, deadline: 1 },
	{
		unique: true,
		partialFilterExpression: {
			recurringTaskId: { $ne: null },
		},
	},
);

// Índices para optimizar consultas comunes
taskSchema.index({ assignedTo: 1, deadline: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

export const TaskModel = mongoose.model("Task", taskSchema);
