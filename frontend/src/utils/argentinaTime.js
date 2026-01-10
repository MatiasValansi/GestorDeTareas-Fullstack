/**
 * Utilidad para manejar hora argentina (UTC-3) en el frontend
 * 
 * PRINCIPIO: "Store UTC, Display Local"
 * - Antes de enviar al backend: convertir hora Argentina a UTC
 * - Al mostrar datos del backend: convertir UTC a hora Argentina
 */

const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

export const ArgentinaTime = {
  /**
   * Convierte una fecha/hora local (Argentina) a UTC para enviar al backend
   * Usar antes de enviar cualquier fecha al servidor
   * 
   * @param {Date|string} localDate - Fecha en hora Argentina (ej: del input datetime-local)
   * @returns {string} ISO string en UTC (ej: "2026-01-10T22:00:00.000Z")
   * 
   * @example
   * // Usuario selecciona 19:00 en un input
   * const deadline = ArgentinaTime.toUTC("2026-01-10T19:00");
   * // Resultado: "2026-01-10T22:00:00.000Z"
   */
  toUTC(localDate) {
    if (!localDate) return null;
    
    // Si es string de un input datetime-local (sin zona horaria)
    // Lo parseamos agregando el offset de Argentina
    const dateStr = localDate.toString();
    
    if (!dateStr.includes('Z') && !/[+-]\d{2}:\d{2}/.test(dateStr)) {
      // No tiene zona horaria, asumimos Argentina (-03:00)
      const dateWithOffset = new Date(dateStr + "-03:00");
      return dateWithOffset.toISOString();
    }
    
    // Ya tiene zona horaria, convertir a ISO
    return new Date(localDate).toISOString();
  },

  /**
   * Convierte una fecha UTC del backend a hora Argentina para mostrar
   * 
   * @param {Date|string} utcDate - Fecha en UTC del backend
   * @returns {Date} Fecha ajustada a Argentina
   */
  fromUTC(utcDate) {
    if (!utcDate) return null;
    return new Date(utcDate);
  },

  /**
   * Formatea una fecha UTC para mostrar en hora Argentina
   * 
   * @param {Date|string} utcDate - Fecha en UTC del backend
   * @param {Object} options - Opciones adicionales de formato
   * @returns {string} Fecha formateada (ej: "10/01/2026, 19:00")
   */
  format(utcDate, options = {}) {
    if (!utcDate) return "";
    
    const defaultOptions = {
      timeZone: ARGENTINA_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    
    return new Date(utcDate).toLocaleString("es-AR", { ...defaultOptions, ...options });
  },

  /**
   * Formatea solo la fecha (sin hora) en hora Argentina
   * @param {Date|string} utcDate - Fecha en UTC
   * @returns {string} Fecha formateada (ej: "10/01/2026")
   */
  formatDate(utcDate) {
    if (!utcDate) return "";
    return new Date(utcDate).toLocaleDateString("es-AR", {
      timeZone: ARGENTINA_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  },

  /**
   * Formatea solo la hora en hora Argentina
   * @param {Date|string} utcDate - Fecha en UTC
   * @returns {string} Hora formateada (ej: "19:00")
   */
  formatTime(utcDate) {
    if (!utcDate) return "";
    return new Date(utcDate).toLocaleTimeString("es-AR", {
      timeZone: ARGENTINA_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  },

  /**
   * Convierte fecha UTC a formato para input datetime-local
   * @param {Date|string} utcDate - Fecha en UTC
   * @returns {string} Formato "YYYY-MM-DDTHH:mm" para inputs
   */
  toInputFormat(utcDate) {
    if (!utcDate) return "";
    
    // Formatear en zona Argentina
    const date = new Date(utcDate);
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: ARGENTINA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    // El formato sv-SE da "YYYY-MM-DD HH:mm", lo convertimos a "YYYY-MM-DDTHH:mm"
    return formatter.format(date).replace(" ", "T");
  },

  /**
   * Obtiene la fecha y hora actual en Argentina como string ISO local
   * Útil para setear valores por defecto en inputs
   * @returns {string} Formato "YYYY-MM-DDTHH:mm"
   */
  nowForInput() {
    return this.toInputFormat(new Date());
  },

  /**
   * Verifica si una fecha ya pasó (comparando en hora Argentina)
   * @param {Date|string} utcDate - Fecha en UTC
   * @returns {boolean} true si ya pasó
   */
  isPast(utcDate) {
    if (!utcDate) return false;
    return new Date(utcDate) < new Date();
  },

  /**
   * Verifica si una fecha es futura
   * @param {Date|string} utcDate - Fecha en UTC
   * @returns {boolean} true si es futura
   */
  isFuture(utcDate) {
    return !this.isPast(utcDate);
  },
};

export default ArgentinaTime;
