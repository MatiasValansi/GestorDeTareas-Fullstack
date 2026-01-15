import { TaskService } from "../services/task.service.js";

export const TaskController = {
    taskAll: async (req, res) => {
        try {
            const tasks = await TaskService.getAllTasks();
            if (tasks.length === 0) {
                return res.status(404).json({ payload: null, message: "No se encontró ninguna tarea", ok: false });
            }
            return res.status(200).json({ message: "Tareas obtenidas", payload: tasks, ok: true });
        } catch (error) {
            console.error("Error al obtener tareas:", error);
            return res.status(500).json({ payload: null, message: error.message, ok: false });
        }
    },

    taskValidation: async (req, res) => {
        try {
            const { id } = req.params;
            const task = await TaskService.getTaskById(id);
            if (!task) {
                return res.status(404).json({ payload: null, message: "Tarea no encontrada", ok: false });
            }
            return res.status(200).json({ message: "Tarea encontrada", payload: { taskFoundById: task }, ok: true });
        } catch (error) {
            console.error("Error al buscar tarea:", error);
            return res.status(500).json({ payload: null, message: error.message, ok: false });
        }
    },

    /**
     * POST /task
     * Body: { task: { title, description, date, deadline, assignedTo, titularId } }
     */
    taskCreateOne: async (req, res) => {
        if (!req.user?.id && !req.user?._id) {
            return res.status(401).json({ payload: null, message: "Usuario no autenticado", ok: false });
        }

        try {
            const { task } = req.body;
            const creator = {
                id: String(req.user._id ?? req.user.id),
                sector: req.user.sector,
                isSupervisor: !!req.user.isSupervisor,
            };

            const createdTask = await TaskService.createTask(task, creator);

            return res.status(201).json({ message: "Tarea creada", payload: createdTask, ok: true });
        } catch (error) {
            console.error("Error al crear tarea:", error);

            if (error.message.includes("incompletos") ||
                error.message.includes("requerido") ||
                error.message.includes("requerida") ||
                error.message.includes("deadline") ||
                error.message.includes("titularId") ||
                error.message.includes("titular")) {
                return res.status(400).json({ payload: null, message: error.message, ok: false });
            }

            if (error.message.includes("sector")) {
                return res.status(403).json({ payload: null, message: error.message, ok: false });
            }

            return res.status(500).json({ payload: null, message: error.message, ok: false });
        }
    },

    /**
     * PUT /task/:id
     */
    taskUpdateOne: async (req, res) => {
        if (!req.user?.id && !req.user?._id) {
            return res.status(401).json({ payload: null, message: "Usuario no autenticado", ok: false });
        }

        try {
            const { id } = req.params;
            const { title, description, completed, status, date, deadline } = req.body;

            const requestingUser = {
                id: String(req.user._id ?? req.user.id),
                isSupervisor: !!req.user.isSupervisor,
            };

            const updateData = {};
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (status !== undefined) updateData.status = status;
            if (completed !== undefined) updateData.completed = completed;
            if (date !== undefined) updateData.date = date;
            if (deadline !== undefined) updateData.deadline = deadline;

            const taskUpdated = await TaskService.updateTask(id, updateData, requestingUser);

            if (!taskUpdated) {
                return res.status(404).json({ payload: null, message: `Tarea ${id} no encontrada`, ok: false });
            }

            return res.status(200).json({ message: "Tarea actualizada", payload: taskUpdated, ok: true });
        } catch (error) {
            console.error("Error al actualizar tarea:", error);

            if (error.message.includes("titular") ||
                error.message.includes("posición 0") ||
                error.message.includes("vencida") ||
                error.message.includes("recurrente")) {
                return res.status(403).json({ payload: null, message: error.message, ok: false });
            }

            if (error.message.includes("deadline")) {
                return res.status(400).json({ payload: null, message: error.message, ok: false });
            }

            return res.status(500).json({ payload: null, message: error.message, ok: false });
        }
    },

    /**
     * DELETE /task/:id
     */
    taskDeleteOne: async (req, res) => {
        if (!req.user?.id && !req.user?._id) {
            return res.status(401).json({ payload: null, message: "Usuario no autenticado", ok: false });
        }

        try {
            const { id } = req.params;
            const requestingUserId = String(req.user._id ?? req.user.id);

            const deletedTask = await TaskService.deleteTask(id, requestingUserId);

            if (!deletedTask) {
                return res.status(404).json({ payload: null, message: `Tarea ${id} no encontrada`, ok: false });
            }

            return res.status(200).json({
                message: `Tarea "${deletedTask.title}" eliminada`,
                payload: { deletedTask },
                ok: true,
            });
        } catch (error) {
            console.error("Error al eliminar tarea:", error);

            if (error.message.includes("titular") || error.message.includes("futura")) {
                return res.status(403).json({ payload: null, message: error.message, ok: false });
            }

            return res.status(500).json({ payload: null, message: error.message, ok: false });
        }
    },

    /**
     * GET /calendar?month=1&year=2026
     */
    calendarTasks: async (req, res) => {
        if (!req.user?.id && !req.user?._id) {
            return res.status(401).json({ payload: null, message: "Usuario no autenticado", ok: false });
        }

        try {
            const month = parseInt(req.query.month, 10);
            const year = parseInt(req.query.year, 10);

            if (!month || !year || month < 1 || month > 12) {
                return res.status(400).json({ payload: null, message: "Parámetros month y year requeridos", ok: false });
            }

            const user = {
                id: String(req.user._id ?? req.user.id),
                sector: req.user.sector,
                isSupervisor: !!req.user.isSupervisor,
            };

            const tasks = await TaskService.getCalendarTasks(user, month, year);

            return res.status(200).json({ message: "Tareas del calendario", payload: tasks, ok: true });
        } catch (error) {
            console.error("Error en calendario:", error);
            return res.status(500).json({ payload: null, message: error.message, ok: false });
        }
    },
};
