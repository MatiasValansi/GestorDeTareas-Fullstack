import { RecurringTaskRepository } from "../repository/recurring.task.repository.js";
import { TaskModel } from "../model/Task.js";

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
	 * Creates a recurring task and generates individual tasks within the specified window
	 * @param {Object} params - The parameters for creating the recurring task
	 * @param {string} params.title - Task title
	 * @param {string} params.description - Task description
	 * @param {string[]} params.assignedTo - Array of user ObjectIds
	 * @param {string} params.createdBy - User ObjectId of the creator (supervisor)
	 * @param {string} params.recurrenceType - "DAILY_PATTERN" or "NUMERIC_PATTERN"
	 * @param {string} params.periodicity - "DIARIA", "SEMANAL", "QUINCENAL" (for DAILY_PATTERN)
	 * @param {string} params.datePattern - Day of week for DAILY_PATTERN (e.g., "LUNES")
	 * @param {number} params.numberPattern - Day of month for NUMERIC_PATTERN (1-31)
	 * @param {Date} params.startingFrom - Anchor date for calculating occurrences
	 * @param {number} params.maxWindow - Days ahead to generate tasks (default: 31)
	 * @returns {Promise<Object>} The created recurring task and generated individual tasks
	 */
	async create(params) {
		const {
			title,
			description,
			assignedTo,
			createdBy,
			recurrenceType,
			periodicity,
			datePattern,
			numberPattern,
			startingFrom,
			maxWindow = 31,
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

		// Create the recurring task record
		const recurringTaskData = {
			title,
			description,
			assignedTo,
			periodicity: finalPeriodicity,
			datePattern: finalDatePattern,
			numberPattern: finalNumberPattern,
			startingFrom: new Date(startingFrom),
			maxWindow,
			active: true,
		};

		const createdRecurringTask = await RecurringTaskRepository.create(recurringTaskData);

		// Calculate occurrence dates and create individual tasks
		const occurrenceDates = this._calculateOccurrenceDates(
			new Date(startingFrom),
			finalPeriodicity,
			finalDatePattern,
			finalNumberPattern,
			maxWindow
		);

		// Create individual tasks for each user and each occurrence date
		const individualTasks = [];
		for (const userId of assignedTo) {
			for (const occurrenceDate of occurrenceDates) {
				const task = new TaskModel({
					title,
					description,
					deadline: occurrenceDate,
					createdBy,
					assignedTo: [userId],
					status: "PENDIENTE",
					recurringTaskId: createdRecurringTask._id,
				});
				const savedTask = await task.save();
				individualTasks.push(savedTask);
			}
		}

		return {
			recurringTask: createdRecurringTask,
			generatedTasks: individualTasks,
			totalTasksGenerated: individualTasks.length,
		};
	},

	/**
	 * Calculates the exact dates for task occurrences within the given window
	 * @param {Date} startingFrom - Anchor date
	 * @param {string} periodicity - Frequency type
	 * @param {string} datePattern - Day of week (for daily pattern)
	 * @param {number} numberPattern - Day of month (for numeric pattern)
	 * @param {number} maxWindow - Days ahead to generate
	 * @returns {Date[]} Array of occurrence dates
	 */
	_calculateOccurrenceDates(startingFrom, periodicity, datePattern, numberPattern, maxWindow) {
		const windowEnd = new Date(startingFrom);
		windowEnd.setDate(windowEnd.getDate() + maxWindow);

		switch (periodicity) {
			case "DIARIA":
				return this._calculateDailyOccurrences(startingFrom, windowEnd);

			case "SEMANAL":
				return this._calculateWeeklyOccurrences(startingFrom, windowEnd, datePattern, 1);

			case "QUINCENAL":
				return this._calculateWeeklyOccurrences(startingFrom, windowEnd, datePattern, 2);

			case "MENSUAL":
				return this._calculateMonthlyOccurrences(startingFrom, windowEnd, numberPattern);

			default:
				return [];
		}
	},

	/**
	 * Calculates daily occurrences between start and end dates
	 * @param {Date} start - Start date
	 * @param {Date} end - End date
	 * @returns {Date[]} Array of daily occurrence dates
	 */
	_calculateDailyOccurrences(start, end) {
		const occurrences = [];
		const currentDate = new Date(start);

		while (currentDate <= end) {
			occurrences.push(new Date(currentDate));
			currentDate.setDate(currentDate.getDate() + 1);
		}

		return occurrences;
	},

	/**
	 * Calculates weekly or biweekly occurrences
	 * @param {Date} start - Start date (anchor)
	 * @param {Date} end - End date
	 * @param {string} datePattern - Target day of week
	 * @param {number} weekInterval - 1 for weekly, 2 for biweekly
	 * @returns {Date[]} Array of occurrence dates
	 */
	_calculateWeeklyOccurrences(start, end, datePattern, weekInterval) {
		const occurrences = [];
		const targetDay = DAY_MAP[datePattern];
		const currentDate = new Date(start);

		// Find the first occurrence of the target day on or after the start date
		const startDayOfWeek = currentDate.getDay();
		let daysUntilTarget = targetDay - startDayOfWeek;

		if (daysUntilTarget < 0) {
			daysUntilTarget += 7;
		}

		currentDate.setDate(currentDate.getDate() + daysUntilTarget);

		// Generate occurrences at the specified interval
		while (currentDate <= end) {
			occurrences.push(new Date(currentDate));
			currentDate.setDate(currentDate.getDate() + 7 * weekInterval);
		}

		return occurrences;
	},

	/**
	 * Calculates monthly occurrences on a specific day of month
	 * @param {Date} start - Start date (anchor)
	 * @param {Date} end - End date
	 * @param {number} dayOfMonth - Target day of month (1-31)
	 * @returns {Date[]} Array of occurrence dates
	 */
	_calculateMonthlyOccurrences(start, end, dayOfMonth) {
		const occurrences = [];
		const currentDate = new Date(start);

		// Set to the target day of the current month
		currentDate.setDate(dayOfMonth);

		// If the target day has already passed this month, move to next month
		if (currentDate < start) {
			currentDate.setMonth(currentDate.getMonth() + 1);
			currentDate.setDate(dayOfMonth);
		}

		while (currentDate <= end) {
			// Handle months with fewer days than the target
			const lastDayOfMonth = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth() + 1,
				0
			).getDate();

			if (dayOfMonth <= lastDayOfMonth) {
				occurrences.push(new Date(currentDate));
			} else {
				// If the day doesn't exist in this month, use the last day
				const adjustedDate = new Date(currentDate);
				adjustedDate.setDate(lastDayOfMonth);
				occurrences.push(adjustedDate);
			}

			// Move to next month
			currentDate.setMonth(currentDate.getMonth() + 1);
			currentDate.setDate(dayOfMonth);
		}

		return occurrences;
	},

	/**
	 * Updates a recurring task's title and/or description
	 * Updates future individual tasks and marks past tasks with modification legend
	 * @param {string} id - MongoDB ObjectId
	 * @param {Object} updateData - Object containing title and/or description
	 * @returns {Promise<Object>} Update result with recurring task and affected tasks count
	 */
	async update(id, updateData) {
		const modificationDate = new Date();
		const MODIFICATION_LEGEND = "\n\n---\n⚠️ Esta tarea tuvo modificaciones posteriores.";

		// Callback to handle individual tasks update
		const handleIndividualTasksUpdate = async (recurringTaskId, updates) => {
			// Update future tasks (deadline >= now) with new title/description
			await TaskModel.updateMany(
				{
					recurringTaskId: recurringTaskId,
					deadline: { $gte: modificationDate },
				},
				{ $set: updates }
			);

			// Add legend to past tasks (deadline < now) without overwriting existing content
			const pastTasks = await TaskModel.find({
				recurringTaskId: recurringTaskId,
				deadline: { $lt: modificationDate },
				description: { $not: { $regex: "Esta tarea tuvo modificaciones posteriores" } },
			});

			for (const task of pastTasks) {
				const updatedDescription = (task.description || "") + MODIFICATION_LEGEND;
				await TaskModel.findByIdAndUpdate(task._id, {
					$set: { description: updatedDescription },
				});
			}
		};

		const updatedRecurringTask = await RecurringTaskRepository.updateById(
			id,
			updateData,
			handleIndividualTasksUpdate
		);

		if (!updatedRecurringTask) {
			return null;
		}

		// Get counts for response
		const futureTasksCount = await TaskModel.countDocuments({
			recurringTaskId: id,
			deadline: { $gte: modificationDate },
		});

		const pastTasksCount = await TaskModel.countDocuments({
			recurringTaskId: id,
			deadline: { $lt: modificationDate },
		});

		return {
			recurringTask: updatedRecurringTask,
			futureTasksUpdated: futureTasksCount,
			pastTasksMarked: pastTasksCount,
		};
	},

	/**
	 * Regenerates individual tasks for a recurring task within a new window
	 * Useful for extending the task generation period
	 * @param {string} id - MongoDB ObjectId of the recurring task
	 * @param {Date} newStartFrom - New starting date for generation
	 * @param {number} newWindow - New window in days
	 * @returns {Promise<Object>} The generated tasks info
	 */
	async regenerateTasks(id, newStartFrom, newWindow) {
		const recurringTask = await RecurringTaskRepository.getById(id);

		if (!recurringTask || !recurringTask.active) {
			throw new Error("Tarea recurrente no encontrada o inactiva");
		}

		const occurrenceDates = this._calculateOccurrenceDates(
			new Date(newStartFrom),
			recurringTask.periodicity,
			recurringTask.datePattern,
			recurringTask.numberPattern,
			newWindow
		);

		// Get existing task deadlines to avoid duplicates
		const existingTasks = await TaskModel.find({
			recurringTaskId: id,
		}).select("deadline assignedTo");

		const existingDateUserPairs = new Set(
			existingTasks.map((t) => `${t.deadline.toISOString()}_${t.assignedTo.toString()}`)
		);

		const individualTasks = [];
		for (const userId of recurringTask.assignedTo) {
			for (const occurrenceDate of occurrenceDates) {
				const dateUserKey = `${occurrenceDate.toISOString()}_${userId.toString()}`;

				// Skip if task already exists for this date and user
				if (existingDateUserPairs.has(dateUserKey)) {
					continue;
				}

				const task = new TaskModel({
					title: recurringTask.title,
					description: recurringTask.description,
					deadline: occurrenceDate,
					assignedTo: userId,
					status: "PENDIENTE",
					recurringTaskId: recurringTask._id,
				});
				const savedTask = await task.save();
				individualTasks.push(savedTask);
			}
		}

		return {
			recurringTask,
			newTasksGenerated: individualTasks.length,
			generatedTasks: individualTasks,
		};
	},
};
