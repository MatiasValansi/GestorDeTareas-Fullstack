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

		// Fecha de inicio de la tarea recurrente (reemplaza startingFrom)
		date: {
			type: Date,
			required: true,
		},

		// Fecha de vencimiento para cada instancia generada
		deadline: {
			type: Date,
			required: true,
		},

		active: {
			type: Boolean,
			default: true,
		},

		// Fecha en que fue desactivada (null si está activa)
		// Una vez desactivada, NO se puede volver a activar
		deactivatedAt: {
			type: Date,
			default: null,
		},

		// Para tareas DIARIAS: incluir o no fines de semana (sábado y domingo)
		// true = todos los días (lunes a domingo)
		// false = solo días hábiles (lunes a viernes)
		includeWeekends: {
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
