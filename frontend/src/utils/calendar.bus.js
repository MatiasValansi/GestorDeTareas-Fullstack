import mitt from 'mitt'

// Event bus singleton (una sola instancia compartida en toda la app)
export const calendarBus = mitt()

// Nombre del evento (evita typos)
export const CALENDAR_EVENTS = {
  REFRESH: 'calendar:refresh'
}