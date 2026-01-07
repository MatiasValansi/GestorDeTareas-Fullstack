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
	 * @param {Date} params.startingFrom - Anchor date (used for QUINCENAL calculations)
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
			startingFrom,
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

		// Create the recurring task record (no individual tasks yet)
		const recurringTaskData = {
			title,
			description,
			assignedTo,
			periodicity: finalPeriodicity,
			datePattern: finalDatePattern,
			numberPattern: finalNumberPattern,
			startingFrom: new Date(startingFrom),
			active: true,
		};

		const createdRecurringTask = await RecurringTaskRepository.create(recurringTaskData);

		return { recurringTask: createdRecurringTask };
	},

	/**
	 * Generates individual tasks for a specific month from all active recurring tasks
	 * Called when a user views a calendar month
	 * @param {number} year - The year (e.g., 2026)
	 * @param {number} month - The month (1-12, January = 1)
	 * @param {string} createdBy - User ObjectId of who triggered the generation
	 * @returns {Promise<Object>} Summary of generated tasks
	 */
	async generateTasksForMonth(year, month, createdBy) {
		// Get all active recurring tasks
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
		};
	},

	/**
	 * Generates individual tasks for a specific recurring task within a month
	 * @param {Document} recurringTask - The recurring task document
	 * @param {number} year - The year
	 * @param {number} month - The month (1-12)
	 * @param {string} createdBy - User ObjectId
	 * @returns {Promise<Array>} Array of generated tasks
	 */
	async _generateTasksForRecurringTask(recurringTask, year, month, createdBy) {
		// Calculate month boundaries (UTC)
		const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
		const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

		// Don't generate tasks before the recurring task was created
		const anchorDate = new Date(recurringTask.startingFrom);

		// If the recurring task starts after this month, skip
		if (anchorDate > monthEnd) {
			return [];
		}

		// Calculate occurrence dates for this month
		const occurrenceDates = this._calculateOccurrencesForMonth(
			recurringTask.startingFrom,
			recurringTask.periodicity,
			recurringTask.datePattern,
			recurringTask.numberPattern,
			year,
			month
		);

		// Get existing tasks to avoid duplicates (check by date + recurringTaskId)
		const existingTasks = await TaskModel.find({
			recurringTaskId: recurringTask._id,
			deadline: { $gte: monthStart, $lte: monthEnd },
		}).select("deadline");

		// Build a Set of existing date strings
		const existingDates = new Set(
			existingTasks.map((t) => t.deadline.toISOString().split("T")[0])
		);

		// Extract all user ObjectIds from assignedTo (handle populated and non-populated)
		const allAssignees = recurringTask.assignedTo.map((user) => user._id || user);

		const individualTasks = [];
		for (const occurrenceDate of occurrenceDates) {
			const dateStr = occurrenceDate.toISOString().split("T")[0];

			// Skip if task already exists for this date
			if (existingDates.has(dateStr)) {
				continue;
			}

			// Create ONE task per date with ALL assignees
			const task = new TaskModel({
				title: recurringTask.title,
				description: recurringTask.description,
				deadline: occurrenceDate,
				createdBy,
				assignedTo: allAssignees,
				status: "PENDIENTE",
				recurringTaskId: recurringTask._id,
			});
			const savedTask = await task.save();
			individualTasks.push(savedTask);
		}

		return individualTasks;
	},

	/**
	 * Calculates occurrence dates for a specific month
	 * @param {Date} anchorDate - Original startingFrom date (for QUINCENAL)
	 * @param {string} periodicity - Frequency type
	 * @param {string} datePattern - Day of week (for weekly patterns)
	 * @param {number} numberPattern - Day of month (for monthly pattern)
	 * @param {number} year - Target year
	 * @param {number} month - Target month (1-12)
	 * @returns {Date[]} Array of occurrence dates within the month
	 */
	_calculateOccurrencesForMonth(anchorDate, periodicity, datePattern, numberPattern, year, month) {
		const monthStart = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0));
		const monthEnd = new Date(Date.UTC(year, month, 0, 12, 0, 0, 0));

		switch (periodicity) {
			case "DIARIA":
				return this._calculateDailyForMonth(monthStart, monthEnd, anchorDate);

			case "SEMANAL":
				return this._calculateWeeklyForMonth(monthStart, monthEnd, datePattern, 1, anchorDate);

			case "QUINCENAL":
				return this._calculateWeeklyForMonth(monthStart, monthEnd, datePattern, 2, anchorDate);

			case "MENSUAL":
				return this._calculateMonthlyForMonth(year, month, numberPattern, anchorDate);

			default:
				return [];
		}
	},

	/**
	 * Calculates daily occurrences for a specific month
	 * @param {Date} monthStart - First day of month
	 * @param {Date} monthEnd - Last day of month
	 * @param {Date} anchorDate - Original start date
	 * @returns {Date[]} Array of daily occurrence dates
	 */
	_calculateDailyForMonth(monthStart, monthEnd, anchorDate) {
		const occurrences = [];
		const anchor = new Date(anchorDate);
		anchor.setUTCHours(12, 0, 0, 0);

		// Start from the first day of the month or anchor date, whichever is later
		const currentDate = new Date(monthStart);
		if (anchor > currentDate) {
			currentDate.setTime(anchor.getTime());
		}
		currentDate.setUTCHours(12, 0, 0, 0);

		while (currentDate <= monthEnd) {
			occurrences.push(new Date(currentDate));
			currentDate.setUTCDate(currentDate.getUTCDate() + 1);
		}

		return occurrences;
	},

	/**
	 * Calculates weekly or biweekly occurrences for a specific month
	 * @param {Date} monthStart - First day of month
	 * @param {Date} monthEnd - Last day of month
	 * @param {string} datePattern - Target day of week
	 * @param {number} weekInterval - 1 for weekly, 2 for biweekly
	 * @param {Date} anchorDate - Original anchor date (critical for biweekly)
	 * @returns {Date[]} Array of occurrence dates
	 */
	_calculateWeeklyForMonth(monthStart, monthEnd, datePattern, weekInterval, anchorDate) {
		const occurrences = [];
		const targetDay = DAY_MAP[datePattern];

		// Start from anchor date to maintain correct week intervals
		const anchor = new Date(anchorDate);
		anchor.setUTCHours(12, 0, 0, 0);

		// Find the first occurrence of target day from anchor
		const anchorDayOfWeek = anchor.getUTCDay();
		let daysUntilTarget = targetDay - anchorDayOfWeek;
		if (daysUntilTarget < 0) {
			daysUntilTarget += 7;
		}

		const firstOccurrence = new Date(anchor);
		firstOccurrence.setUTCDate(anchor.getUTCDate() + daysUntilTarget);

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
	 * @param {number} year - Target year
	 * @param {number} month - Target month (1-12)
	 * @param {number} dayOfMonth - Target day (1-31)
	 * @param {Date} anchorDate - Original anchor date
	 * @returns {Date[]} Array with single occurrence or empty
	 */
	_calculateMonthlyForMonth(year, month, dayOfMonth, anchorDate) {
		const anchor = new Date(anchorDate);
		anchor.setUTCHours(0, 0, 0, 0);

		// Get the last day of the target month
		const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

		// Determine the actual day to use
		const actualDay = Math.min(dayOfMonth, lastDayOfMonth);

		const occurrenceDate = new Date(Date.UTC(year, month - 1, actualDay, 12, 0, 0, 0));

		// Don't generate if the occurrence is before the anchor date
		if (occurrenceDate < anchor) {
			return [];
		}

		return [occurrenceDate];
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
