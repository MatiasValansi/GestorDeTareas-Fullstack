import { MongoTaskRepository } from "../repository/task.mongo.repository.js";
import { MongoUserRepository } from "../repository/user.mongo.repository.js";
import { ArgentinaTime } from "../utils/argentinaTime.js";
import { RecurringTaskService } from "./recurring.task.service.js";
import { sendTaskAssignedEmail } from "./email.service.js";

/**
 * TaskService - Capa de lógica de negocio para tareas
 * 
 * Reglas de negocio principales:
 * 1. El "titular" es SIEMPRE el usuario en posición 0 de assignedTo
 * 2. Solo el titular puede editar la tarea
 * 3. No se pueden editar tareas VENCIDAS ni RECURRENTES
 * 4. Si supervisor no se incluye en la tarea, debe especificar titularId
 */
class TaskServiceClass {
    constructor(taskRepository, userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    // ═══════════════════════════════════════════════════════════════════
    // HELPERS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Normaliza cualquier valor a string de ID
     * Soporta: string, ObjectId, {_id: ...}, {id: ...}
     */
    _toIdString(val) {
        if (!val) return null;
        if (typeof val === "string") return val;
        if (val._id) return String(val._id);
        if (val.id) return String(val.id);
        return String(val);
    }

    /**
     * Obtiene el ID del titular (posición 0 de assignedTo)
     */
    _getTaskOwnerId(task) {
        if (!task?.assignedTo || task.assignedTo.length === 0) return null;
        return this._toIdString(task.assignedTo[0]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Valida que una fecha no sea anterior al momento actual
     * Aplica tanto para 'date' como para 'deadline'
     */
    _validateNotInPast(date, fieldName = "fecha") {
        if (!date) return;
        const now = new Date();
        const taskDate = new Date(date);
        if (taskDate < now) {
            throw new Error(`La ${fieldName} no puede ser anterior al momento actual`);
        }
    }

    /**
     * Valida que deadline >= date
     */
    _validateDates(date, deadline) {
        if (!date || !deadline) {
            throw new Error("Las fechas 'date' y 'deadline' son obligatorias");
        }
        const taskDate = new Date(date);
        const taskDeadline = new Date(deadline);
        if (taskDeadline < taskDate) {
            throw new Error("La fecha de vencimiento (deadline) debe ser igual o posterior a la fecha de la tarea (date)");
        }
    }

    /**
     * Valida si el usuario puede editar la tarea
     * 
     * REGLAS:
     * 1. Solo el titular (posición 0) puede editar campos generales
     * 2. Cualquier asignado puede marcar como completada
     * 3. No se pueden editar tareas VENCIDAS
     * 4. No se pueden editar tareas RECURRENTES (excepto para completar)
     */
    _validateCanEdit(task, userId, isOnlyCompletionUpdate = false) {
        const normalizedUserId = this._toIdString(userId);
        const taskOwner = this._getTaskOwnerId(task);

        // Para marcar como completada: cualquier asignado puede hacerlo
        if (isOnlyCompletionUpdate) {
            const isAssigned = task.assignedTo?.some(
                assigned => this._toIdString(assigned) === normalizedUserId
            );
            if (!isAssigned) {
                throw new Error("Solo los usuarios asignados a la tarea pueden marcarla como completada");
            }
        } else {
            // Para ediciones generales: solo el titular
            if (!taskOwner || !normalizedUserId || taskOwner !== normalizedUserId) {
                throw new Error("Solo el titular de la tarea (posición 0 en asignados) puede editarla");
            }
        }

        // Regla: No editar tareas vencidas
        if (task.status === "VENCIDA") {
            throw new Error("No se pueden editar tareas vencidas");
        }

        // Regla: No editar tareas completadas
        if (task.status === "COMPLETADA") {
            throw new Error("No se pueden editar tareas que ya están completadas");
        }

        // Regla: No editar tareas recurrentes (EXCEPTO para marcar como completada)
        if (task.recurringTaskId && !isOnlyCompletionUpdate) {
            throw new Error("No se pueden editar tareas recurrentes. Modifique la tarea recurrente original.");
        }
    }

    /**
     * Valida si el usuario puede eliminar la tarea
     */
    _validateCanDelete(task, userId) {
        const normalizedUserId = this._toIdString(userId);
        const taskOwner = this._getTaskOwnerId(task);

        if (!taskOwner || !normalizedUserId || taskOwner !== normalizedUserId) {
            throw new Error("Solo el titular de la tarea (posición 0 en asignados) puede eliminarla");
        }

        // No se pueden eliminar tareas completadas
        if (task.status === "COMPLETADA") {
            throw new Error("No se pueden eliminar tareas que ya están completadas");
        }

        if (task.deadline && ArgentinaTime.isExpired(task.deadline)) {
            throw new Error("Solo se pueden eliminar tareas con fecha de vencimiento futura");
        }
    }

    /**
     * Valida y resuelve los usuarios asignados según el rol del creador
     * 
     * REGLAS:
     * - Usuario NO supervisor: se asigna a sí mismo (él es titular)
     * - Supervisor que SE incluye: él queda como titular (posición 0)
     * - Supervisor que NO se incluye: DEBE especificar titularId
     * 
     * @param {Object} creator - {id, sector, isSupervisor}
     * @param {Array} assignedTo - IDs de usuarios a asignar
     * @param {string|null} titularId - ID del titular (cuando supervisor no se incluye)
     * @returns {Promise<Array>} Array ordenado con titular en posición 0
     */
    async _validateAndResolveAssignees(creator, assignedTo, titularId = null) {
        const { id: creatorId, sector: creatorSector, isSupervisor } = creator;

        // Usuario NO supervisor: siempre se asigna a sí mismo
        if (!isSupervisor) {
            return [creatorId];
        }

        // ===== SUPERVISOR =====
        const assignedIds = Array.isArray(assignedTo)
            ? [...assignedTo]
            : assignedTo ? [assignedTo] : [];

        // Si no hay asignados, permitir tarea sin asignar
        if (assignedIds.length === 0) {
            return [];
        }

        // Validar que todos pertenezcan al mismo sector
        const users = await Promise.all(
            assignedIds.map((id) => this.userRepository.getById(id))
        );

        const invalidUser = users.find((u) => !u || u.sector !== creatorSector);
        if (invalidUser !== undefined) {
            throw new Error("Todos los usuarios asignados deben pertenecer al mismo sector");
        }

        // ¿El supervisor se incluyó a sí mismo?
        const supervisorIncluded = assignedIds.some(
            (id) => this._toIdString(id) === this._toIdString(creatorId)
        );

        if (supervisorIncluded) {
            // Supervisor se incluyó: él queda como titular (posición 0)
            const others = assignedIds.filter(
                (id) => this._toIdString(id) !== this._toIdString(creatorId)
            );
            return [creatorId, ...others];
        }

        // Supervisor NO se incluyó: DEBE especificar titularId
        if (!titularId) {
            throw new Error("Debe especificar el titular de la tarea (titularId) cuando no se incluye en los asignados");
        }

        // Validar que el titular esté en la lista
        const titularInList = assignedIds.some(
            (id) => this._toIdString(id) === this._toIdString(titularId)
        );
        if (!titularInList) {
            throw new Error("El titular especificado debe estar en la lista de asignados");
        }

        // Reordenar: titular en posición 0
        const others = assignedIds.filter(
            (id) => this._toIdString(id) !== this._toIdString(titularId)
        );
        return [titularId, ...others];
    }

    // ═══════════════════════════════════════════════════════════════════
    // MÉTODOS PÚBLICOS - Casos de Uso
    // ═══════════════════════════════════════════════════════════════════

    async getAllTasks() {
        return (await this.taskRepository.getAll()) || [];
    }

    async getTaskById(taskId) {
        return (await this.taskRepository.getById(taskId)) || null;
    }

    /**
     * Crea una nueva tarea
     * 
     * @param {Object} taskData - {title, description, date, deadline, assignedTo, titularId, status}
     * @param {Object} creator - {id, sector, isSupervisor}
     */
    async createTask(taskData, creator) {
        const { title, description, date, deadline, assignedTo, titularId, status } = taskData;

        if (!title || !deadline) {
            throw new Error("Datos de tarea incompletos (title, deadline son requeridos)");
        }
        if (!date) {
            throw new Error("La fecha de la tarea (date) es requerida");
        }

        // Validar que las fechas no sean anteriores al momento actual
        this._validateNotInPast(date, "fecha de la tarea");
        this._validateNotInPast(deadline, "fecha de vencimiento");

        this._validateDates(date, deadline);

        // Resolver asignados con lógica de titular
        const validatedAssignees = await this._validateAndResolveAssignees(
            creator,
            assignedTo,
            titularId
        );

        const newTaskData = {
            title,
            description,
            date: new Date(date),
            deadline: new Date(deadline),
            createdBy: creator.id,
            assignedTo: validatedAssignees,
            status: status || "PENDIENTE",
        };

        // 1) Crear la tarea SIEMPRE (aunque falle el mail)
        const createdTask = await this.taskRepository.createOne(newTaskData);
        const createdTaskObj = typeof createdTask?.toObject === "function"
            ? createdTask.toObject()
            : createdTask;

        // 2) Intentar enviar notificación por email (best-effort)
        let emailSent = false;
        let emailError = null;

        try {
            const emails = await this.userRepository.getUsersEmails(validatedAssignees);

            if (emails.length > 0) {
                await sendTaskAssignedEmail({ to: emails, task: createdTaskObj });
                emailSent = true;
                console.log("✅ MAIL ENVIADO");
            } else {
                console.log("⚠️ NO SE ENVIO MAIL - NO HAY EMAILS");
            }
        } catch (mailError) {
            console.error("❌ Error enviando mail de tarea:", mailError);
            emailError = mailError?.message || "Error desconocido al enviar email";
        }

        return {
            task: createdTaskObj,
            emailSent,
            emailError,
        };
    }

    /**
     * Valida que las fechas de actualización no sean anteriores a la fecha actual
     * @param {Date|string} date - Fecha de inicio de la tarea
     * @param {Date|string} deadline - Fecha de vencimiento de la tarea
     */
    _validateUpdateDatesNotInPast(date, deadline) {
        const now = new Date();
        
        if (date !== undefined) {
            const taskDate = new Date(date);
            if (taskDate < now) {
                throw new Error("La fecha de inicio no puede ser anterior al momento actual de modificación");
            }
        }
        
        if (deadline !== undefined) {
            const taskDeadline = new Date(deadline);
            if (taskDeadline < now) {
                throw new Error("La fecha de vencimiento no puede ser anterior al momento actual de modificación");
            }
        }
    }

    /**
     * Valida y procesa la actualización de assignedTo
     * 
     * REGLAS:
     * 1. El titular (posición 0) NO puede quitarse de la tarea
     * 2. Si la tarea pasa de individual a compartida, debe agregar al menos un usuario
     * 3. Si no hay cambios reales en assignedTo, no se debe permitir la actualización
     * 
     * @param {Object} currentTask - Tarea actual
     * @param {Array} newAssignedTo - Nueva lista de asignados
     * @returns {Array|null} - Array de IDs validado o null si no hay cambios
     */
    async _validateAndProcessAssignedToUpdate(currentTask, newAssignedTo) {
        if (!newAssignedTo || !Array.isArray(newAssignedTo)) {
            return null;
        }

        const currentOwnerId = this._getTaskOwnerId(currentTask);
        const currentAssignedIds = (currentTask.assignedTo || []).map(id => this._toIdString(id));
        const newAssignedIds = newAssignedTo.map(id => this._toIdString(id));

        // Validar que el titular siga en la lista
        if (!newAssignedIds.includes(currentOwnerId)) {
            throw new Error("El titular de la tarea (posición 0) no puede ser removido de los asignados");
        }

        // Verificar que el titular siga en posición 0
        if (newAssignedIds[0] !== currentOwnerId) {
            throw new Error("El titular de la tarea debe permanecer en la posición 0 de los asignados");
        }

        // Verificar si hay cambios reales
        const currentSorted = [...currentAssignedIds].sort();
        const newSorted = [...newAssignedIds].sort();
        
        const hasChanges = currentSorted.length !== newSorted.length ||
            currentSorted.some((id, idx) => id !== newSorted[idx]);

        if (!hasChanges) {
            return null; // No hay cambios
        }

        // Validar que todos los nuevos usuarios existan y pertenezcan al mismo sector
        const currentOwner = await this.userRepository.getById(currentOwnerId);
        if (!currentOwner) {
            throw new Error("No se pudo obtener la información del titular de la tarea");
        }

        for (const userId of newAssignedIds) {
            if (userId === currentOwnerId) continue; // Ya validamos al titular
            
            const user = await this.userRepository.getById(userId);
            if (!user) {
                throw new Error(`El usuario con ID ${userId} no existe`);
            }
            if (user.sector !== currentOwner.sector) {
                throw new Error("Todos los usuarios asignados deben pertenecer al mismo sector");
            }
        }

        return newAssignedIds;
    }

    /**
     * Actualiza una tarea
     * 
     * REGLA: Solo el titular (posición 0) puede editar
     * EXCEPCIÓN: Las tareas recurrentes SÍ pueden marcarse como completadas
     */
    async updateTask(taskId, updateData, requestingUser) {
        const currentTask = await this.taskRepository.getById(taskId);
        if (!currentTask) return null;

        // Extraer y normalizar el ID del usuario
        const userId = this._toIdString(requestingUser?.id ?? requestingUser);

        // Detectar si es SOLO una actualización de completado/status
        const allowedCompletionFields = ['status', 'completed'];
        const updateFields = Object.keys(updateData);
        const isOnlyCompletionUpdate = updateFields.every(field => allowedCompletionFields.includes(field));

        // Validar permisos (titular, no vencida, y recurrente solo si es completado)
        this._validateCanEdit(currentTask, userId, isOnlyCompletionUpdate);

        // Validar fechas si se actualizan
        if (updateData.date !== undefined || updateData.deadline !== undefined) {
            // Primero validar que las nuevas fechas no sean anteriores al momento actual
            this._validateUpdateDatesNotInPast(updateData.date, updateData.deadline);
            
            // Luego validar la relación entre date y deadline
            const newDate = updateData.date !== undefined
                ? new Date(updateData.date)
                : currentTask.date;
            const newDeadline = updateData.deadline !== undefined
                ? new Date(updateData.deadline)
                : currentTask.deadline;
            this._validateDates(newDate, newDeadline);
        }

        // Procesar actualización de assignedTo si se proporciona
        // Guardar los IDs originales antes de validar
        const originalAssignedIds = (currentTask.assignedTo || []).map(id => this._toIdString(id));
        let newUsersToNotify = [];

        if (updateData.assignedTo !== undefined) {
            const validatedAssignedTo = await this._validateAndProcessAssignedToUpdate(
                currentTask, 
                updateData.assignedTo
            );
            
            if (validatedAssignedTo === null) {
                // No hay cambios reales en assignedTo, eliminarlo del update
                delete updateData.assignedTo;
            } else {
                updateData.assignedTo = validatedAssignedTo;
                
                // Detectar usuarios nuevos agregados (para notificación)
                newUsersToNotify = validatedAssignedTo.filter(
                    id => !originalAssignedIds.includes(id)
                );
            }
        }

        // Verificar que haya algo que actualizar
        if (Object.keys(updateData).length === 0) {
            throw new Error("No hay cambios para guardar");
        }

        // Actualizar la tarea
        const updatedTask = await this.taskRepository.updateOne(taskId, updateData);

        // Variables para tracking de email
        let emailSent = false;
        let emailError = null;
        let emailsSentCount = 0;

        // Enviar email a los usuarios nuevos agregados
        if (newUsersToNotify.length > 0 && updatedTask) {
            try {
                const emails = await this.userRepository.getUsersEmails(newUsersToNotify);
                
                if (emails.length > 0) {
                    const taskObj = typeof updatedTask?.toObject === "function"
                        ? updatedTask.toObject()
                        : updatedTask;
                    
                    await sendTaskAssignedEmail({ to: emails, task: taskObj });
                    emailSent = true;
                    emailsSentCount = emails.length;
                    console.log(`✅ EMAIL ENVIADO a ${emails.length} usuario(s) agregado(s) a tarea editada`);
                }
            } catch (mailError) {
                // No fallar la actualización si el email falla
                emailError = mailError.message || "Error desconocido al enviar email";
                console.error("❌ Error enviando email a nuevos usuarios:", mailError);
            }
        }

        return {
            task: updatedTask,
            emailSent,
            emailError,
            emailsSentCount,
            newUsersNotified: newUsersToNotify.length,
        };
    }

    /**
     * Elimina una tarea
     */
    async deleteTask(taskId, requestingUserId) {
        const taskToDelete = await this.taskRepository.getById(taskId);
        if (!taskToDelete) return null;

        const userId = this._toIdString(requestingUserId);
        this._validateCanDelete(taskToDelete, userId);

        await this.taskRepository.deleteOne(taskId);
        return taskToDelete;
    }

    /**
     * Obtiene tareas para calendario
     */
    async getCalendarTasks(user, month, year) {
        await RecurringTaskService.generateTasksForMonth(year, month, user.id);

        const startDate = new Date(Date.UTC(year, month - 1, 1));
        startDate.setUTCDate(startDate.getUTCDate() - 7);

        const endDate = new Date(Date.UTC(year, month, 0));
        endDate.setUTCDate(endDate.getUTCDate() + 7);
        endDate.setUTCHours(23, 59, 59, 999);

        let userIdsToQuery;
        if (user.isSupervisor) {
            const usersInSector = await this.userRepository.getBySector(user.sector);
            userIdsToQuery = usersInSector.map((u) => u._id);
        } else {
            userIdsToQuery = [user.id];
        }

        return this.taskRepository.getByDateRangeAndUsers(startDate, endDate, userIdsToQuery);
    }

    async markExpiredTasks() {
        const now = new Date();
        console.log(`[markExpiredTasks] Hora Argentina: ${ArgentinaTime.format(now)}`);
        const result = await this.taskRepository.markExpiredTasks(now);
        if (result.modifiedCount > 0) {
            console.log(`  → ${result.modifiedCount} tareas marcadas como VENCIDAS`);
        }
        return { modifiedCount: result.modifiedCount };
    }

    async getTasksBetween(from, to, userIds) {
        await this.markExpiredTasks();
        return this.taskRepository.getByDateRangeAndUsers(from, to, userIds);
    }
}

const taskRepository = new MongoTaskRepository();
const userRepository = new MongoUserRepository();

export const TaskService = new TaskServiceClass(taskRepository, userRepository);
