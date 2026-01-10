/**
 * Middleware para procesar fechas de las peticiones
 * Convierte fechas que vienen como hora Argentina (sin timezone o con -03:00) a UTC
 * 
 * Esto asegura que todas las fechas se almacenen en UTC en la BD
 */

import { ArgentinaTime } from "../utils/argentinaTime.js";

// Campos de fecha que deben ser procesados
const DATE_FIELDS = ["deadline", "startingFrom", "date", "createdAt", "updatedAt"];

/**
 * Procesa recursivamente un objeto y convierte los campos de fecha a UTC
 * @param {Object} obj - Objeto a procesar
 * @returns {Object} Objeto con fechas convertidas a UTC
 */
const processDateFields = (obj) => {
	if (!obj || typeof obj !== "object") return obj;
	
	if (Array.isArray(obj)) {
		return obj.map(processDateFields);
	}
	
	const processed = { ...obj };
	
	for (const [key, value] of Object.entries(processed)) {
		if (DATE_FIELDS.includes(key) && value) {
			// Convertir a UTC usando nuestra utilidad
			processed[key] = ArgentinaTime.parseFromFrontend(value);
		} else if (typeof value === "object" && value !== null) {
			processed[key] = processDateFields(value);
		}
	}
	
	return processed;
};

/**
 * Middleware que procesa automáticamente las fechas en el body de la request
 * Las convierte de hora Argentina a UTC antes de que lleguen al controller
 */
export const parseDateFields = (req, res, next) => {
	if (req.body) {
		req.body = processDateFields(req.body);
	}
	next();
};

/**
 * Helper para usar en controllers si no se usa el middleware global
 * @param {Object} data - Datos con posibles campos de fecha
 * @returns {Object} Datos con fechas en UTC
 */
export const convertDatesToUTC = (data) => processDateFields(data);

export default parseDateFields;
