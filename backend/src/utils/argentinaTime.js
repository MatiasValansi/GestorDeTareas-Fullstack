/**
 * Utilidad para manejar hora argentina (UTC-3) de forma centralizada
 * Argentina NO usa horario de verano, siempre es UTC-3
 * 
 * PRINCIPIO: "Store UTC, Display Local"
 * - Las fechas se ALMACENAN en UTC en la base de datos
 * - Las fechas se MUESTRAN en hora Argentina al usuario
 * - El frontend CONVIERTE de hora local a UTC antes de enviar
 */

const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_OFFSET_HOURS = -3;
const ARGENTINA_OFFSET_MS = ARGENTINA_OFFSET_HOURS * 60 * 60 * 1000;

export const ArgentinaTime = {
	/**
	 * Obtiene la fecha/hora actual en UTC
	 * @returns {Date} Fecha actual en UTC
	 */
	nowUTC() {
		return new Date();
	},

	/**
	 * Convierte una fecha/hora Argentina a UTC para almacenar en BD
	 * Usar cuando el frontend envía una fecha en hora Argentina
	 * 
	 * @param {Date|string} argentinaDate - Fecha en hora Argentina
	 * @returns {Date} Fecha en UTC
	 * 
	 * @example
	 * // Usuario selecciona 19:00 Argentina
	 * // Input: "2026-01-10T19:00:00" (sin Z, interpretado como Argentina)
	 * // Output: "2026-01-10T22:00:00.000Z" (UTC)
	 */
	argentinaToUTC(argentinaDate) {
		if (!argentinaDate) return null;
		
		const date = new Date(argentinaDate);
		// Si la fecha ya tiene Z o offset, asumimos que ya está en UTC
		const dateStr = argentinaDate.toString();
		if (dateStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
			return date;
		}
		
		// Si no tiene zona horaria, asumimos que es hora Argentina
		// Sumamos 3 horas para convertir a UTC
		return new Date(date.getTime() - ARGENTINA_OFFSET_MS);
	},

	/**
	 * Convierte una fecha UTC a hora Argentina para mostrar al usuario
	 * 
	 * @param {Date|string} utcDate - Fecha en UTC (de la BD)
	 * @returns {Date} Fecha en hora Argentina
	 * 
	 * @example
	 * // Input: "2026-01-10T22:00:00.000Z" (UTC de la BD)
	 * // Output: Date representando 2026-01-10T19:00:00 Argentina
	 */
	utcToArgentina(utcDate) {
		if (!utcDate) return null;
		const date = new Date(utcDate);
		return new Date(date.getTime() + ARGENTINA_OFFSET_MS);
	},

	/**
	 * Verifica si una fecha (en UTC) ya venció comparando con la hora actual
	 * @param {Date} utcDeadline - Fecha límite en UTC (de la BD)
	 * @returns {boolean} true si ya venció
	 */
	isExpired(utcDeadline) {
		if (!utcDeadline) return false;
		const now = new Date();
		const deadline = new Date(utcDeadline);
		return deadline <= now;
	},

	/**
	 * Verifica si una fecha (en UTC) es futura
	 * @param {Date} utcDeadline - Fecha límite en UTC
	 * @returns {boolean} true si es futura
	 */
	isFuture(utcDeadline) {
		return !this.isExpired(utcDeadline);
	},

	/**
	 * Formatea una fecha UTC para mostrar en hora Argentina
	 * @param {Date} utcDate - Fecha en UTC
	 * @param {Object} options - Opciones de formato (Intl.DateTimeFormat)
	 * @returns {string} Fecha formateada en hora Argentina
	 */
	format(utcDate, options = {}) {
		if (!utcDate) return null;
		
		const defaultOptions = {
			timeZone: ARGENTINA_TIMEZONE,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		};
		
		return new Date(utcDate).toLocaleString("es-AR", { ...defaultOptions, ...options });
	},

	/**
	 * Formatea solo la fecha (sin hora) en hora Argentina
	 * @param {Date} utcDate - Fecha en UTC
	 * @returns {string} Fecha formateada DD/MM/YYYY
	 */
	formatDate(utcDate) {
		if (!utcDate) return null;
		return new Date(utcDate).toLocaleDateString("es-AR", {
			timeZone: ARGENTINA_TIMEZONE,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
	},

	/**
	 * Formatea solo la hora en hora Argentina
	 * @param {Date} utcDate - Fecha en UTC
	 * @returns {string} Hora formateada HH:MM
	 */
	formatTime(utcDate) {
		if (!utcDate) return null;
		return new Date(utcDate).toLocaleTimeString("es-AR", {
			timeZone: ARGENTINA_TIMEZONE,
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	},

	/**
	 * Obtiene la fecha actual en Argentina como string ISO (para logs/debug)
	 * @returns {string} Fecha actual en formato legible
	 */
	nowFormatted() {
		return this.format(new Date());
	},

	/**
	 * Crea una fecha UTC para el inicio de un mes
	 * @param {number} year - Año
	 * @param {number} month - Mes (1-12)
	 * @returns {Date} Primer momento del mes en UTC
	 */
	getMonthStartUTC(year, month) {
		return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
	},

	/**
	 * Crea una fecha UTC para el fin de un mes
	 * @param {number} year - Año
	 * @param {number} month - Mes (1-12)
	 * @returns {Date} Último momento del mes en UTC
	 */
	getMonthEndUTC(year, month) {
		return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
	},

	/**
	 * Parsea una fecha que viene del frontend
	 * Si viene con 'Z' o offset, la usa tal cual
	 * Si viene sin zona horaria, asume que es hora Argentina y convierte a UTC
	 * 
	 * @param {string} dateString - String de fecha del frontend
	 * @returns {Date} Fecha en UTC lista para guardar en BD
	 */
	parseFromFrontend(dateString) {
		if (!dateString) return null;
		
		// Si ya tiene Z (UTC) o offset explícito, parsear directo
		if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
			return new Date(dateString);
		}
		
		// Si no tiene zona horaria, asumimos hora Argentina
		// Agregamos el offset de Argentina para que JS lo parsee correctamente a UTC
		return new Date(dateString + "-03:00");
	},

	/**
	 * Convierte una fecha a formato ISO con zona horaria Argentina explícita
	 * Útil para respuestas de API que deben mostrar la hora Argentina
	 * 
	 * @param {Date} utcDate - Fecha en UTC
	 * @returns {string} ISO string con offset Argentina (ej: "2026-01-10T19:00:00-03:00")
	 */
	toArgentinaISO(utcDate) {
		if (!utcDate) return null;
		const argDate = this.utcToArgentina(utcDate);
		
		const year = argDate.getUTCFullYear();
		const month = String(argDate.getUTCMonth() + 1).padStart(2, '0');
		const day = String(argDate.getUTCDate()).padStart(2, '0');
		const hours = String(argDate.getUTCHours()).padStart(2, '0');
		const minutes = String(argDate.getUTCMinutes()).padStart(2, '0');
		const seconds = String(argDate.getUTCSeconds()).padStart(2, '0');
		
		return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
	},
};

