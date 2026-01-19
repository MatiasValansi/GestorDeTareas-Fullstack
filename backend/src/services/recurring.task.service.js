import { RecurringTaskRepository } from "../repository/recurring.task.repository.js";
import { TaskModel } from "../model/Task.js";
import { ArgentinaTime } from "../utils/argentinaTime.js";

// Maps Spanish day names to JavaScript getDay() values (0 = Sunday, 1 = Monday, etc.)
const DAY_MAP = {
	DOMINGO: 0,
	LUNES: 1,
	MARTES: 2,
	MIERCOLES: 3,
	JUEVES: 4,
	VIERNES: 5,
	SABADO: 6,
};

export const RecurringTaskService = {
	/**
	 * Creates a recurring task definition (does NOT generate individual tasks)
	 * Individual tasks are generated on-demand when a user views a specific month
	 * @param {Object} params - The parameters for creating the recurring task
	 * @param {string} params.title - Task title
	 * @param {string} params.description - Task description
	 * @param {string[]} params.assignedTo - Array of user ObjectIds
	 * @param {string} params.recurrenceType - "DAILY_PATTERN" or "NUMERIC_PATTERN"
	 * @param {string} params.periodicity - "DIARIA", "SEMANAL", "QUINCENAL" (for DAILY_PATTERN)
	 * @param {string} params.datePattern - Day of week for DAILY_PATTERN (e.g., "LUNES")
	 * @param {number} params.numberPattern - Day of month for NUMERIC_PATTERN (1-31)
	 * @param {Date} params.date - Fecha de inicio (anchor date)
	 * @param {Date} params.deadline - Fecha de vencimiento
	 * @returns {Promise<Object>} The created recurring task
	 */
	async create(params) {
		const {
			title,
			description,
			assignedTo,
			recurrenceType,
			periodicity,
			datePattern,
			numberPattern,
			date,
			deadline,
			includeWeekends,
		} = params;

		// Validate recurrence type and set appropriate values
		let finalPeriodicity;
		let finalDatePattern = null;
		let finalNumberPattern = null;

		if (recurrenceType === "NUMERIC_PATTERN") {
			// Numeric pattern: monthly frequency by default
			finalPeriodicity = "MENSUAL";
			finalNumberPattern = numberPattern;

			if (!numberPattern || numberPattern < 1 || numberPattern > 31) {
				throw new Error("El patrón numérico debe estar entre 1 y 31");
			}
		} else if (recurrenceType === "DAILY_PATTERN") {
			// Daily pattern: user selects frequency explicitly
			finalPeriodicity = periodicity;
			finalDatePattern = datePattern;

			if (!periodicity) {
				throw new Error("La periodicidad es requerida para el patrón diario");
			}

			// datePattern is required for SEMANAL and QUINCENAL
			if ((periodicity === "SEMANAL" || periodicity === "QUINCENAL") && !datePattern) {
				throw new Error("El patrón de día es requerido para frecuencia semanal o quincenal");
			}
		} else {
			throw new Error("Tipo de recurrencia inválido. Use DAILY_PATTERN o NUMERIC_PATTERN");
		}

		// Validar que date no sea anterior al momento actual
		if (!date) {
			throw new Error("La fecha de la tarea (date) es requerida");
		}
		const taskDate = new Date(date);
		if (taskDate < new Date()) {
			throw new Error("La fecha de la tarea no puede ser anterior al momento actual");
		}

		// Validar que deadline esté presente y sea >= date
		if (!deadline) {
			throw new Error("La fecha de vencimiento (deadline) es requerida");
		}
		const taskDeadline = new Date(deadline);
		if (taskDeadline < new Date()) {
			throw new Error("La fecha de vencimiento no puede ser anterior al momento actual");
		}
		if (taskDeadline < taskDate) {
			throw new Error("La fecha de vencimiento debe ser igual o posterior a la fecha de la tarea");
		}

		// Create the recurring task record (no individual tasks yet)
		const recurringTaskData = {
			title,
			description,
			assignedTo,
			periodicity: finalPeriodicity,
			datePattern: finalDatePattern,
			numberPattern: finalNumberPattern,
			date: taskDate,
			deadline: taskDeadline,
			active: true,
			// Para periodicidad DIARIA: indica si incluye fines de semana (default: true)
			includeWeekends: includeWeekends !== undefined ? includeWeekends : true,
		};

		const createdRecurringTask = await RecurringTaskRepository.create(recurringTaskData);

		return { recurringTask: createdRecurringTask };
	},

	/**
	 * Marca como VENCIDAS las tareas cuyo deadline ya pasó (hora Argentina)
	 * @returns {Promise<Object>} Resultado con cantidad de tareas actualizadas
	 */
	async markExpiredTasks() {
		const now = new Date();
		
		
		const result = await TaskModel.updateMany(
			{
				status: "PENDIENTE",
				deadline: { $lt: now },
			},
			{
				$set: { status: "VENCIDA" },
			},
		);
		
		
		
		return { expiredTasksMarked: result.modifiedCount };
	},

	/**
	 * Generates individual tasks for a specific month from all active recurring tasks
	 * Called when a user views a calendar month
	 * Also marks expired tasks as VENCIDA (hora Argentina)
	 * @param {number} year - The year (e.g., 2026)
	 * @param {number} month - The month (1-12, January = 1)
	 * @param {string} createdBy - User ObjectId of who triggered the generation
	 * @returns {Promise<Object>} Summary of generated tasks and expired tasks marked
	 */
	async generateTasksForMonth(year, month, createdBy) {
		// PASO 1: Marcar tareas vencidas ANTES de generar nuevas
		const expiredResult = await this.markExpiredTasks();

		// PASO 2: Get all active recurring tasks
		const recurringTasks = await RecurringTaskRepository.getAllActive();

		const allGeneratedTasks = [];

		for (const recurringTask of recurringTasks) {
			const generatedTasks = await this._generateTasksForRecurringTask(
				recurringTask,
				year,
				month,
				createdBy
			);
			allGeneratedTasks.push(...generatedTasks);
		}

		return {
			year,
			month,
			totalTasksGenerated: allGeneratedTasks.length,
			generatedTasks: allGeneratedTasks,
			expiredTasksMarked: expiredResult.expiredTasksMarked,
		};
	},

	/**
	 * Generates individual tasks for a specific recurring task within a month
	 * El year/month son los que el usuario ve en el calendario (hora Argentina)
	 * 
	 * @param {Document} recurringTask - The recurring task document
	 * @param {number} year - The year (calendario Argentina)
	 * @param {number} month - The month (1-12, calendario Argentina)
	 * @param {string} createdBy - User ObjectId
	 * @returns {Promise<Array>} Array of generated tasks
	 */
	async _generateTasksForRecurringTask(recurringTask, year, month, createdBy) {
		// Límites del mes extendidos para cubrir tareas que en UTC pueden estar
		// en el día anterior/siguiente pero en Argentina pertenecen al mes actual
		const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
		// Extendemos hasta 03:00 UTC del día siguiente para cubrir 23:59:59 Argentina
		const monthEnd = new Date(Date.UTC(year, month, 1, 2, 59, 59, 999));

		// Don't generate tasks before the recurring task was created
		const anchorDate = new Date(recurringTask.date);

		// If the recurring task starts after this month, skip
		if (anchorDate > monthEnd) {
			return [];
		}

		// Calcular la diferencia entre date y deadline para aplicarla a cada instancia
		const deadlineOffset = recurringTask.deadline.getTime() - recurringTask.date.getTime();

		// Calculate occurrence dates for this month
		const occurrenceDates = this._calculateOccurrencesForMonth(
			recurringTask.date,
			recurringTask.periodicity,
			recurringTask.datePattern,
			recurringTask.numberPattern,
			year,
			month,
			recurringTask.includeWeekends !== false // default true para compatibilidad
		);

		// Get existing tasks to avoid duplicates (check by date + recurringTaskId)
		const existingTasks = await TaskModel.find({
			recurringTaskId: recurringTask._id,
			date: { $gte: monthStart, $lte: monthEnd },
		}).select("date");

		// Build a Set of existing date strings using Argentina date
		// CRÍTICO: Usar fecha Argentina para evitar duplicados en el día correcto
		const existingDates = new Set(
			existingTasks.map(t => ArgentinaTime.formatDate(t.date))
		);

		// Extract all user ObjectIds from assignedTo (handle populated and non-populated)
		const allAssignees = recurringTask.assignedTo.map((user) => user._id || user);

		const individualTasks = [];
		for (const occurrenceDate of occurrenceDates) {
			// Usar fecha Argentina para verificar duplicados
			const dateStr = ArgentinaTime.formatDate(occurrenceDate);

			if (existingDates.has(dateStr)) {
				continue;
			}

			// Calcular el deadline para esta instancia aplicando el offset
			const instanceDeadline = new Date(occurrenceDate.getTime() + deadlineOffset);

			const task = new TaskModel({
				title: recurringTask.title,
				description: recurringTask.description,
				date: occurrenceDate,
				deadline: instanceDeadline,
				createdBy,
				assignedTo: allAssignees,
				status: "PENDIENTE",
				recurringTaskId: recurringTask._id,
			});

			try {
				const savedTask = await task.save();
				individualTasks.push(savedTask);
			} catch (err) {
				if (err.code === 11000) continue;
				throw err;
			}
		}
		return individualTasks;
	},

	/**
	 * Calculates occurrence dates for a specific month
	 * IMPORTANTE: Preserva la hora del anchorDate (date) en las ocurrencias generadas
	 * El year/month son los que el usuario ve en el calendario (hora Argentina)
	 * 
	 * @param {Date} anchorDate - Original date in UTC (define la hora de las tareas)
	 * @param {string} periodicity - Frequency type
	 * @param {string} datePattern - Day of week (for weekly patterns)
	 * @param {number} numberPattern - Day of month (for monthly pattern)
	 * @param {number} year - Target year (calendario Argentina)
	 * @param {number} month - Target month (1-12, calendario Argentina)
	 * @param {boolean} includeWeekends - Para DIARIA: si incluir sábados y domingos (default: true)
	 * @returns {Date[]} Array of occurrence dates in UTC within the month
	 */
	_calculateOccurrencesForMonth(anchorDate, periodicity, datePattern, numberPattern, year, month, includeWeekends = true) {
		// Los límites del mes en UTC, extendidos para cubrir cualquier hora Argentina
		// El inicio del mes en Argentina (00:00) es el día anterior a las 03:00 UTC
		// El fin del mes en Argentina (23:59) es el día siguiente a las 02:59 UTC
		const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
		// Extendemos hasta 03:00 UTC del día siguiente para cubrir 23:59:59 Argentina
		const monthEnd = new Date(Date.UTC(year, month, 1, 2, 59, 59, 999));
		
		// Extraer la hora UTC del anchorDate para aplicarla a todas las ocurrencias
		const anchor = new Date(anchorDate);
		const anchorHours = anchor.getUTCHours();
		const anchorMinutes = anchor.getUTCMinutes();
		const anchorSeconds = anchor.getUTCSeconds();

		switch (periodicity) {
			case "DIARIA":
				return this._calculateDailyForMonth(monthStart, monthEnd, anchorDate, anchorHours, anchorMinutes, anchorSeconds, includeWeekends);

			case "SEMANAL":
				return this._calculateWeeklyForMonth(monthStart, monthEnd, datePattern, 1, anchorDate, anchorHours, anchorMinutes, anchorSeconds);

			case "QUINCENAL":
				return this._calculateWeeklyForMonth(monthStart, monthEnd, datePattern, 2, anchorDate, anchorHours, anchorMinutes, anchorSeconds);

			case "MENSUAL":
				return this._calculateMonthlyForMonth(year, month, numberPattern, anchorDate, anchorHours, anchorMinutes, anchorSeconds);

			default:
				return [];
		}
	},

	/**
	 * Calculates daily occurrences for a specific month
	 * IMPORTANTE: Usa hora Argentina para determinar el día de la semana
	 * ya que las fechas se guardan en UTC pero representan hora Argentina
	 * 
	 * @param {Date} monthStart - First day of month
	 * @param {Date} monthEnd - Last day of month
	 * @param {Date} anchorDate - Original start date
	 * @param {number} hours - Hora UTC del anchor
	 * @param {number} minutes - Minutos del anchor
	 * @param {number} seconds - Segundos del anchor
	 * @param {boolean} includeWeekends - Si incluir sábados (6) y domingos (0) en hora Argentina
	 * @returns {Date[]} Array of daily occurrence dates
	 */
	_calculateDailyForMonth(monthStart, monthEnd, anchorDate, hours, minutes, seconds, includeWeekends = true) {
		const occurrences = [];
		const anchor = new Date(anchorDate);

		// Start from the first day of the month or anchor date, whichever is later
		const currentDate = new Date(monthStart);
		if (anchor > currentDate) {
			currentDate.setTime(anchor.getTime());
		}
		// Aplicar la hora del anchor
		currentDate.setUTCHours(hours, minutes, seconds, 0);

		while (currentDate <= monthEnd) {
			// CRÍTICO: Usar hora Argentina para determinar el día de la semana
			// Una fecha UTC que es martes 00:30 puede ser lunes 21:30 en Argentina
			const dayOfWeekArgentina = ArgentinaTime.getArgentinaDay(currentDate);
			
			// Si includeWeekends es false, omitir sábados (6) y domingos (0) EN HORA ARGENTINA
			const isWeekend = dayOfWeekArgentina === 0 || dayOfWeekArgentina === 6;
			if (includeWeekends || !isWeekend) {
				occurrences.push(new Date(currentDate));
			}
			
			currentDate.setUTCDate(currentDate.getUTCDate() + 1);
		}

		return occurrences;
	},

	/**
	 * Calculates weekly or biweekly occurrences for a specific month
	 * IMPORTANTE: Usa hora Argentina para determinar el día de la semana
	 * 
	 * @param {Date} monthStart - First day of month
	 * @param {Date} monthEnd - Last day of month
	 * @param {string} datePattern - Target day of week (LUNES, MARTES, etc.)
	 * @param {number} weekInterval - 1 for weekly, 2 for biweekly
	 * @param {Date} anchorDate - Original anchor date in UTC (critical for biweekly)
	 * @param {number} hours - Hora UTC del anchor
	 * @param {number} minutes - Minutos del anchor
	 * @param {number} seconds - Segundos del anchor
	 * @returns {Date[]} Array of occurrence dates in UTC
	 */
	_calculateWeeklyForMonth(monthStart, monthEnd, datePattern, weekInterval, anchorDate, hours, minutes, seconds) {
		const occurrences = [];
		const targetDay = DAY_MAP[datePattern];

		const anchor = new Date(anchorDate);

		// CRÍTICO: Obtener el día de la semana del anchor en HORA ARGENTINA
		// Si es domingo 22:00 Argentina (lunes 01:00 UTC), debe ser DOMINGO (0)
		const anchorDayInArgentina = ArgentinaTime.getArgentinaDay(anchor);

		// Calcular días hasta el día objetivo EN HORA ARGENTINA
		let daysUntilTarget = targetDay - anchorDayInArgentina;
		if (daysUntilTarget < 0) {
			daysUntilTarget += 7;
		}

		// La primera ocurrencia es el anchor + días hasta el target
		// Pero mantenemos las horas UTC del anchor
		const firstOccurrence = new Date(anchor);
		firstOccurrence.setUTCDate(anchor.getUTCDate() + daysUntilTarget);
		firstOccurrence.setUTCHours(hours, minutes, seconds, 0);

		// Calculate how many intervals from first occurrence to reach month start
		const msPerWeek = 7 * 24 * 60 * 60 * 1000 * weekInterval;
		const msDiff = monthStart.getTime() - firstOccurrence.getTime();

		let currentDate;
		if (msDiff <= 0) {
			// First occurrence is after or at month start
			currentDate = new Date(firstOccurrence);
		} else {
			// Jump forward to the nearest occurrence at or after month start
			const intervalsToSkip = Math.floor(msDiff / msPerWeek);
			currentDate = new Date(firstOccurrence);
			currentDate.setUTCDate(currentDate.getUTCDate() + intervalsToSkip * 7 * weekInterval);
			// If we're still before month start, advance one more interval
			if (currentDate < monthStart) {
				currentDate.setUTCDate(currentDate.getUTCDate() + 7 * weekInterval);
			}
		}
		// Asegurar hora correcta después de los cálculos
		currentDate.setUTCHours(hours, minutes, seconds, 0);

		// Generate occurrences within the month
		while (currentDate <= monthEnd) {
			if (currentDate >= monthStart) {
				occurrences.push(new Date(currentDate));
			}
			currentDate.setUTCDate(currentDate.getUTCDate() + 7 * weekInterval);
		}

		return occurrences;
	},

	/**
	 * Calculates monthly occurrence for a specific month
	 * IMPORTANTE: El dayOfMonth es el día que el usuario ve en Argentina
	 * La hora (hours, minutes, seconds) ya viene en UTC desde el anchor
	 * 
	 * @param {number} year - Target year (calendario Argentina)
	 * @param {number} month - Target month (1-12, calendario Argentina)
	 * @param {number} dayOfMonth - Target day (1-31, día que el usuario seleccionó)
	 * @param {Date} anchorDate - Original anchor date (UTC)
	 * @param {number} hours - Hora UTC del anchor
	 * @param {number} minutes - Minutos del anchor
	 * @param {number} seconds - Segundos del anchor
	 * @returns {Date[]} Array with single occurrence or empty
	 */
	_calculateMonthlyForMonth(year, month, dayOfMonth, anchorDate, hours, minutes, seconds) {
		const anchor = new Date(anchorDate);

		// Obtener la hora Argentina del anchor para construir la ocurrencia correctamente
		const argHours = ArgentinaTime.getArgentinaHours(anchor);
		const argMinutes = ArgentinaTime.getArgentinaMinutes(anchor);

		// Get the last day of the target month
		const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

		// Determine the actual day to use
		const actualDay = Math.min(dayOfMonth, lastDayOfMonth);

		// Crear la fecha en hora Argentina y convertir a UTC
		// month-1 porque createFromArgentinaComponents usa 0-11
		const occurrenceDate = ArgentinaTime.createFromArgentinaComponents(
			year, 
			month - 1, 
			actualDay, 
			argHours, 
			argMinutes, 
			0
		);

		// Don't generate if the occurrence is before the anchor date
		if (occurrenceDate < anchor) {
			return [];
		}

		return [occurrenceDate];
	},

	/**
	 * Updates a recurring task's assignedTo list ONLY
	 * - Only the task owner (position 0 in assignedTo) can modify
	 * - The owner cannot remove themselves from the task
	 * - If task is shared: can add/remove users (except owner) or make it non-shared
	 * - If task is not shared: can make it shared and add users
	 * - Future tasks are updated with new assignedTo
	 * - Past tasks are NOT modified but receive a legend indicating modification date
	 * @param {string} id - MongoDB ObjectId
	 * @param {Object} updateData - Object containing assignedTo array
	 * @param {string} requestingUserId - ObjectId of the user making the request
	 * @returns {Promise<Object>} Update result with recurring task and affected tasks count
	 */
	async update(id, updateData, requestingUserId) {
		const modificationDate = new Date();

		// Get the current recurring task to validate ownership
		const recurringTask = await RecurringTaskRepository.getById(id);
		if (!recurringTask) {
			return null;
		}

		// Verificar si la tarea está desactivada
		if (recurringTask.active === false || recurringTask.deactivatedAt) {
			throw new Error("No se puede modificar una tarea recurrente desactivada");
		}

		// Get the task owner (first in assignedTo array)
		const taskOwner = recurringTask.assignedTo[0]._id
			? recurringTask.assignedTo[0]._id.toString()
			: recurringTask.assignedTo[0].toString();

		// Verify the requesting user is the task owner (position 0)
		if (taskOwner !== requestingUserId) {
			throw new Error("Solo el titular de la tarea (posición 0 del assignedTo) puede modificarla");
		}

		// VALIDACIÓN: Solo se permite modificar assignedTo
		if (updateData.title !== undefined || updateData.description !== undefined) {
			throw new Error("Solo se permite modificar la lista de usuarios asignados (assignedTo)");
		}

		// Validate assignedTo is provided and is an array
		if (updateData.assignedTo === undefined) {
			throw new Error("Se debe proporcionar la lista de usuarios asignados (assignedTo)");
		}

		if (!Array.isArray(updateData.assignedTo)) {
			throw new Error("assignedTo debe ser un array");
		}

		if (updateData.assignedTo.length < 1) {
			throw new Error("La tarea debe tener al menos un usuario asignado");
		}

		// Ensure the owner (first user) remains in first position - cannot remove or change position
		const newFirstUser = updateData.assignedTo[0].toString();
		if (newFirstUser !== taskOwner) {
			throw new Error("El titular no puede quitarse a sí mismo ni cambiar su posición");
		}

		// Determinar el tipo de cambio (para información en la respuesta)
		const wasShared = recurringTask.assignedTo.length > 1;
		const willBeShared = updateData.assignedTo.length > 1;
		let changeType = "modificación de usuarios";

		if (wasShared && !willBeShared) {
			changeType = "tarea dejó de ser compartida";
		} else if (!wasShared && willBeShared) {
			changeType = "tarea ahora es compartida";
		}

		// Build modification legend for past tasks
		const formattedDate = ArgentinaTime.formatDate(modificationDate);
		const MODIFICATION_LEGEND = ` | La tarea recurrente fue modificada el ${formattedDate}.`;

		// Only update assignedTo in the data to pass to repository
		const sanitizedUpdateData = {
			assignedTo: updateData.assignedTo,
		};

		// Callback to handle individual tasks update
		const handleIndividualTasksUpdate = async (recurringTaskId, updates) => {
			// ONLY update FUTURE tasks (date >= now) with new assignedTo
			if (updates.assignedTo) {
				await TaskModel.updateMany(
					{
						recurringTaskId: recurringTaskId,
						date: { $gte: modificationDate },
					},
					{ $set: { assignedTo: updates.assignedTo } }
				);
			}

			// Add legend to PAST tasks (date < now) - do NOT modify their assignedTo
			const pastTasks = await TaskModel.find({
				recurringTaskId: recurringTaskId,
				date: { $lt: modificationDate },
			});

			for (const task of pastTasks) {
				const hasLegend = task.description && task.description.includes("La tarea recurrente fue modificada");
				let updatedDescription;

				if (!hasLegend) {
					// First modification - add full legend
					updatedDescription = (task.description || "") + MODIFICATION_LEGEND;
				} else {
					// Already has legend - append new modification date
					updatedDescription = task.description + ` Nueva modificación el ${formattedDate}.`;
				}

				await TaskModel.findByIdAndUpdate(task._id, {
					$set: { description: updatedDescription },
				});
			}
		};

		const updatedRecurringTask = await RecurringTaskRepository.updateById(
			id,
			sanitizedUpdateData,
			handleIndividualTasksUpdate
		);

		if (!updatedRecurringTask) {
			return null;
		}

		// Get counts for response
		const futureTasksCount = await TaskModel.countDocuments({
			recurringTaskId: id,
			date: { $gte: modificationDate },
		});

		const pastTasksCount = await TaskModel.countDocuments({
			recurringTaskId: id,
			date: { $lt: modificationDate },
		});

		return {
			recurringTask: updatedRecurringTask,
			futureTasksUpdated: futureTasksCount,
			pastTasksMarked: pastTasksCount,
			changeType,
			isShared: willBeShared,
			modificationDate: formattedDate,
		};
	},

    	/**
	 * Sets active state to false for a recurring task
	 * IMPORTANTE: Una vez desactivada, NO se puede volver a activar
	 * Elimina tareas futuras NO completadas, pero mantiene las completadas y las pasadas
	 * @param {string} id - MongoDB ObjectId
	 * @returns {Promise<Object>} Update result with recurring task and affected tasks count
	 */
    async deactivate(id) {

        const recurringTask = await RecurringTaskRepository.getById(id);
		if (!recurringTask) {
			return null;
		}

		// Verificar si ya está desactivada
		if (recurringTask.active === false || recurringTask.deactivatedAt) {
			throw new Error("Esta tarea recurrente ya fue desactivada y no puede modificarse");
		}

		const now = new Date();

        const updatedRecurringTask = await RecurringTaskRepository.updateById(
			id,
			{ 
				active: false,
				deactivatedAt: now
			}
		);

        // Eliminar tareas individuales FUTURAS que NO estén completadas
		const deleteResult = await this.deleteFutureNonCompletedTasks(id, now);

		return {
            updatedRecurringTask,
			deletedFutureTasks: deleteResult.deletedCount,
			deactivatedAt: now
        };
    },

    /**
	 * Deletes all FUTURE individual tasks related to the recurringTask that are NOT completed
	 * Keeps: tasks with date <= now, OR tasks that are already COMPLETADA
	 * @param {string} id - MongoDB ObjectId of the recurring task
	 * @param {Date} referenceDate - Reference date for determining "future"
	 * @returns {Promise<Object>} Deletion result with count
	 */
    async deleteFutureNonCompletedTasks(id, referenceDate) {
        const recurringTask = await RecurringTaskRepository.getById(id);
		if (!recurringTask) {
			return { deletedCount: 0 };
		}

        // Eliminar tareas que:
		// 1. Pertenecen a esta recurring task
		// 2. Tienen date > referenceDate (son futuras)
		// 3. NO están completadas
        const deleteResult = await TaskModel.deleteMany({
			recurringTaskId: id,
			date: { $gt: referenceDate },
			status: { $ne: "COMPLETADA" }
		});

        return {
            deletedCount: deleteResult.deletedCount,
        };
    },

	/**
	 * NOT EXPOSED TO USERS, FOR ADMIN USE ONLY
	 * Deletes all FUTURE individual tasks related to the recurringTask (including completed)
	 * @param {string} id - MongoDB ObjectId of the recurring task
	 * @returns {Promise<Object|null>} Deletion result with counts, or null if not found
	 * @deprecated Use deleteFutureNonCompletedTasks instead
	 */
    async deleteAllFutureIndividualTasks(id) {

        const recurringTask = await RecurringTaskRepository.getById(id);
		if (!recurringTask) {
			return null;
		}

        const deleteResult = await TaskModel.deleteMany({
				recurringTaskId: id,
                date: { $gt: new Date() },
			});
        const deletedCount = deleteResult.deletedCount;

        return {
            recurringTask: recurringTask,
            deletedFutureIndividualTasks: deletedCount,
        };
    },

	/**
     * NOT EXPOSED TO USERS, TO BE RAN ONLY BY ADMINS IF NEEDED
	 * Deletes a recurring task and ALL its associated individual tasks
	 * @param {string} id - MongoDB ObjectId of the recurring task
	 * @returns {Promise<Object|null>} Deletion result with counts, or null if not found
	 */
	async delete(id) {
		// First, check if the recurring task exists
		const recurringTask = await RecurringTaskRepository.getById(id);
		if (!recurringTask) {
			return null;
		}

		// Delete all individual tasks that belong to this recurring task
		const deleteResult = await TaskModel.deleteMany({ recurringTaskId: id });
		const deletedIndividualTasksCount = deleteResult.deletedCount;

		// Delete the recurring task itself
		const deletedRecurringTask = await RecurringTaskRepository.deleteById(id);

		return {
			recurringTask: deletedRecurringTask,
			deletedIndividualTasks: deletedIndividualTasksCount,
		};
	},
};
