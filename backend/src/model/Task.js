// export class Task {
//   constructor(id, title, description, userId, status = "pending") {
//     this.id = id; // string o número único
//     this.title = title; // título de la tarea
//     this.description = description; // descripción opcional
//     this.userId = userId; // id del usuario asignado
//     this.status = status; // estado inicial (pending, completed, etc.)
//   }
// }

import mongoose, { Schema } from "mongoose";

const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		date: {
			type: Date,
			required: true,
		},
		//Establecemos la relación entre Task y User
		assignedTo: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{
		timestamps: true,
	},
	{ collection: "tasks" },
);

export const TaskModel = mongoose.model("Task", taskSchema);
