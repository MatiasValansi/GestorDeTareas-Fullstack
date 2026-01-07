import mongoose from "mongoose";

const PERIODICITY = ["DIARIA", "SEMANAL", "QUINCENAL", "MENSUAL"];
const DAYS_OF_WEEK = [
	"LUNES",
	"MARTES",
	"MIERCOLES",
	"JUEVES",
	"VIERNES",
	"SABADO",
	"DOMINGO",
];

const recurringTaskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},

		description: {
			type: String,
		},

		assignedTo: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				required: true,
			},
		],

		periodicity: {
			type: String,
			enum: PERIODICITY,
			required: true,
		},

		// Ej: LUNES, MARTES (para semanal / quincenal)
		datePattern: {
			type: String,
			enum: DAYS_OF_WEEK,
		},

		// Que el patrón sea un n° de día en específico (para frecuencia mensual)
		numberPattern: {
			type: Number,
			min: 1,
		},

		startingFrom: {
			type: Date,
			required: true,
		},

		active: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
	},
);

export const RecurringTaskModel = mongoose.model(
	"RecurringTask",
	recurringTaskSchema,
);
