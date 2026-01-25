/**
 * Tests Unitarios para TaskServiceClass
 * 
 * Cobertura:
 * - Creación de tareas (validaciones, roles, asignados)
 * - Actualización de tareas (permisos, fechas, assignedTo)
 * - Eliminación de tareas (titular, estados)
 * - Helpers privados
 * - Operaciones de lectura
 */

// Mock del servicio de email ANTES de importar TaskServiceClass
jest.mock('../services/email.service.js', () => ({
    sendTaskAssignedEmail: jest.fn().mockResolvedValue(true)
}));

// Mock de RecurringTaskService
jest.mock('../services/recurring.task.service.js', () => ({
    RecurringTaskService: {
        generateTasksForMonth: jest.fn().mockResolvedValue([])
    }
}));

import { TaskServiceClass } from '../services/task.service.js';
import { sendTaskAssignedEmail } from '../services/email.service.js';

describe('TaskService - Tests Unitarios', () => {
    let taskService;
    let mockTaskRepository;
    let mockUserRepository;

    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const mockUsers = {
        supervisor: {
            _id: '507f1f77bcf86cd799439011',
            id: '507f1f77bcf86cd799439011',
            name: 'Supervisor Test',
            email: 'supervisor@test.com',
            sector: 'IT',
            isSupervisor: true
        },
        regularUser1: {
            _id: '507f1f77bcf86cd799439022',
            id: '507f1f77bcf86cd799439022',
            name: 'Usuario Regular 1',
            email: 'user1@test.com',
            sector: 'IT',
            isSupervisor: false
        },
        regularUser2: {
            _id: '507f1f77bcf86cd799439033',
            id: '507f1f77bcf86cd799439033',
            name: 'Usuario Regular 2',
            email: 'user2@test.com',
            sector: 'IT',
            isSupervisor: false
        },
        otherSectorUser: {
            _id: '507f1f77bcf86cd799439044',
            id: '507f1f77bcf86cd799439044',
            name: 'Usuario Otro Sector',
            email: 'other@test.com',
            sector: 'HR',
            isSupervisor: false
        }
    };

    // Helper para crear fechas futuras
    const getFutureDate = (daysFromNow) => {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        return date;
    };

    const getPastDate = (daysAgo) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date;
    };

    beforeEach(() => {
        // Resetear mocks antes de cada test
        jest.clearAllMocks();

        mockTaskRepository = {
            getAll: jest.fn(),
            getById: jest.fn(),
            createOne: jest.fn(),
            updateOne: jest.fn(),
            deleteOne: jest.fn(),
            getByDateRangeAndUsers: jest.fn(),
            markExpiredTasks: jest.fn()
        };

        mockUserRepository = {
            getById: jest.fn(),
            getBySector: jest.fn(),
            getUsersEmails: jest.fn()
        };

        taskService = new TaskServiceClass(mockTaskRepository, mockUserRepository);
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE HELPERS PRIVADOS
    // ═════════════════════════════════════════════════════════════

    describe('Helpers privados', () => {
        describe('_toIdString', () => {
            test('Convierte string a string (sin cambios)', () => {
                const result = taskService._toIdString('507f1f77bcf86cd799439011');
                expect(result).toBe('507f1f77bcf86cd799439011');
            });

            test('Convierte objeto con _id a string', () => {
                const result = taskService._toIdString({ _id: '507f1f77bcf86cd799439011' });
                expect(result).toBe('507f1f77bcf86cd799439011');
            });

            test('Convierte objeto con id a string', () => {
                const result = taskService._toIdString({ id: '507f1f77bcf86cd799439011' });
                expect(result).toBe('507f1f77bcf86cd799439011');
            });

            test('Maneja null correctamente', () => {
                const result = taskService._toIdString(null);
                expect(result).toBeNull();
            });

            test('Maneja undefined correctamente', () => {
                const result = taskService._toIdString(undefined);
                expect(result).toBeNull();
            });

            test('Convierte ObjectId-like a string', () => {
                const mockObjectId = {
                    toString: () => '507f1f77bcf86cd799439011'
                };
                const result = taskService._toIdString(mockObjectId);
                expect(result).toBe('507f1f77bcf86cd799439011');
            });
        });

        describe('_getTaskOwnerId', () => {
            test('Obtiene el ID del titular (posición 0)', () => {
                const task = {
                    assignedTo: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439022']
                };
                const result = taskService._getTaskOwnerId(task);
                expect(result).toBe('507f1f77bcf86cd799439011');
            });

            test('Retorna null si assignedTo está vacío', () => {
                const task = { assignedTo: [] };
                const result = taskService._getTaskOwnerId(task);
                expect(result).toBeNull();
            });

            test('Retorna null si assignedTo es undefined', () => {
                const task = {};
                const result = taskService._getTaskOwnerId(task);
                expect(result).toBeNull();
            });

            test('Retorna null si task es null', () => {
                const result = taskService._getTaskOwnerId(null);
                expect(result).toBeNull();
            });

            test('Maneja objetos con _id en assignedTo', () => {
                const task = {
                    assignedTo: [
                        { _id: '507f1f77bcf86cd799439011' },
                        { _id: '507f1f77bcf86cd799439022' }
                    ]
                };
                const result = taskService._getTaskOwnerId(task);
                expect(result).toBe('507f1f77bcf86cd799439011');
            });
        });

        describe('_validateDates', () => {
            test('Acepta deadline igual a date', () => {
                const date = getFutureDate(5);
                expect(() => taskService._validateDates(date, date)).not.toThrow();
            });

            test('Acepta deadline posterior a date', () => {
                const date = getFutureDate(5);
                const deadline = getFutureDate(10);
                expect(() => taskService._validateDates(date, deadline)).not.toThrow();
            });

            test('Rechaza deadline anterior a date', () => {
                const date = getFutureDate(10);
                const deadline = getFutureDate(5);
                expect(() => taskService._validateDates(date, deadline))
                    .toThrow('La fecha de vencimiento (deadline) debe ser igual o posterior a la fecha de la tarea (date)');
            });

            test('Rechaza si falta date', () => {
                const deadline = getFutureDate(5);
                expect(() => taskService._validateDates(null, deadline))
                    .toThrow("Las fechas 'date' y 'deadline' son obligatorias");
            });

            test('Rechaza si falta deadline', () => {
                const date = getFutureDate(5);
                expect(() => taskService._validateDates(date, null))
                    .toThrow("Las fechas 'date' y 'deadline' son obligatorias");
            });
        });

        describe('_validateNotInPast', () => {
            test('Acepta fecha futura', () => {
                const futureDate = getFutureDate(5);
                expect(() => taskService._validateNotInPast(futureDate, 'fecha de prueba'))
                    .not.toThrow();
            });

            test('Rechaza fecha pasada', () => {
                const pastDate = getPastDate(5);
                expect(() => taskService._validateNotInPast(pastDate, 'fecha de prueba'))
                    .toThrow('La fecha de prueba no puede ser anterior al momento actual');
            });

            test('No hace nada si fecha es null', () => {
                expect(() => taskService._validateNotInPast(null, 'fecha')).not.toThrow();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE CREACIÓN DE TAREAS
    // ═════════════════════════════════════════════════════════════

    describe('createTask', () => {
        describe('✅ Casos Exitosos', () => {
            test('Usuario NO supervisor crea tarea y se asigna a sí mismo', async () => {
                const taskData = {
                    title: 'Tarea de prueba',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                const createdTask = {
                    _id: 'task123',
                    ...taskData,
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: creator.id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.createOne.mockResolvedValue(createdTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([mockUsers.regularUser1.email]);

                const result = await taskService.createTask(taskData, creator);

                expect(result.task).toBeDefined();
                expect(result.task.assignedTo).toContain(creator.id);
                expect(mockTaskRepository.createOne).toHaveBeenCalledWith(
                    expect.objectContaining({
                        assignedTo: [creator.id]
                    })
                );
            });

            test('Supervisor incluido queda como titular (posición 0)', async () => {
                const taskData = {
                    title: 'Tarea compartida',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.supervisor._id]
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1) // primer usuario
                    .mockResolvedValueOnce(mockUsers.supervisor);  // supervisor

                const createdTask = {
                    _id: 'task456',
                    ...taskData,
                    assignedTo: [mockUsers.supervisor._id, mockUsers.regularUser1._id],
                    createdBy: creator.id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.createOne.mockResolvedValue(createdTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([]);

                const result = await taskService.createTask(taskData, creator);

                expect(result.task).toBeDefined();
                // Verificar que el supervisor está en posición 0
                expect(mockTaskRepository.createOne).toHaveBeenCalledWith(
                    expect.objectContaining({
                        assignedTo: expect.arrayContaining([mockUsers.supervisor._id])
                    })
                );
                const createCall = mockTaskRepository.createOne.mock.calls[0][0];
                expect(createCall.assignedTo[0]).toBe(mockUsers.supervisor._id);
            });

            test('Supervisor NO incluido especifica titularId correctamente', async () => {
                const taskData = {
                    title: 'Tarea delegada',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    titularId: mockUsers.regularUser1._id
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1)
                    .mockResolvedValueOnce(mockUsers.regularUser2);

                const createdTask = {
                    _id: 'task789',
                    ...taskData,
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: creator.id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.createOne.mockResolvedValue(createdTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([]);

                const result = await taskService.createTask(taskData, creator);

                expect(result.task).toBeDefined();
                // Verificar que el titular especificado está en posición 0
                const createCall = mockTaskRepository.createOne.mock.calls[0][0];
                expect(createCall.assignedTo[0]).toBe(mockUsers.regularUser1._id);
            });

            test('Permite crear tarea sin asignados (array vacío) por supervisor', async () => {
                const taskData = {
                    title: 'Tarea sin asignar',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: []
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                const createdTask = {
                    _id: 'task000',
                    ...taskData,
                    assignedTo: [],
                    createdBy: creator.id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.createOne.mockResolvedValue(createdTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([]);

                const result = await taskService.createTask(taskData, creator);

                expect(result.task).toBeDefined();
                expect(result.task.assignedTo).toEqual([]);
            });

            test('Crea tarea y envía email correctamente', async () => {
                const taskData = {
                    title: 'Tarea con notificación',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                const createdTask = {
                    _id: 'taskEmail',
                    ...taskData,
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: creator.id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.createOne.mockResolvedValue(createdTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([mockUsers.regularUser1.email]);

                const result = await taskService.createTask(taskData, creator);

                expect(result.emailSent).toBe(true);
                expect(sendTaskAssignedEmail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: [mockUsers.regularUser1.email]
                    })
                );
            });

            test('Crea tarea incluso si falla el envío de email', async () => {
                const taskData = {
                    title: 'Tarea con error de email',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                const createdTask = {
                    _id: 'taskEmailFail',
                    ...taskData,
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: creator.id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.createOne.mockResolvedValue(createdTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([mockUsers.regularUser1.email]);
                sendTaskAssignedEmail.mockRejectedValueOnce(new Error('SMTP Error'));

                const result = await taskService.createTask(taskData, creator);

                // La tarea se crea aunque falle el email
                expect(result.task).toBeDefined();
                expect(result.emailSent).toBe(false);
                expect(result.emailError).toBe('SMTP Error');
            });
        });

        describe('❌ Validaciones y Errores', () => {
            test('Rechaza tarea sin title', async () => {
                const taskData = {
                    description: 'Solo descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('Datos de tarea incompletos (title, deadline son requeridos)');
            });

            test('Rechaza tarea sin deadline', async () => {
                const taskData = {
                    title: 'Tarea sin deadline',
                    date: getFutureDate(1)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('Datos de tarea incompletos (title, deadline son requeridos)');
            });

            test('Rechaza tarea sin date', async () => {
                const taskData = {
                    title: 'Tarea sin fecha',
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('La fecha de la tarea (date) es requerida');
            });

            test('Rechaza date anterior al momento actual', async () => {
                const taskData = {
                    title: 'Tarea pasada',
                    date: getPastDate(5),
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('La fecha de la tarea no puede ser anterior al momento actual');
            });

            test('Rechaza deadline anterior al momento actual', async () => {
                const taskData = {
                    title: 'Deadline pasado',
                    date: getFutureDate(1),
                    deadline: getPastDate(1)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('La fecha de vencimiento no puede ser anterior al momento actual');
            });

            test('Rechaza deadline anterior a date', async () => {
                const taskData = {
                    title: 'Deadline antes que date',
                    date: getFutureDate(10),
                    deadline: getFutureDate(5)
                };
                const creator = {
                    id: mockUsers.regularUser1._id,
                    sector: mockUsers.regularUser1.sector,
                    isSupervisor: false
                };

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('La fecha de vencimiento (deadline) debe ser igual o posterior a la fecha de la tarea (date)');
            });

            test('Rechaza si supervisor NO incluido no especifica titularId', async () => {
                const taskData = {
                    title: 'Tarea sin titular',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id]
                    // Sin titularId
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1)
                    .mockResolvedValueOnce(mockUsers.regularUser2);

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('Debe especificar el titular de la tarea (titularId) cuando no se incluye en los asignados');
            });

            test('Rechaza si titularId no está en assignedTo', async () => {
                const taskData = {
                    title: 'Titular fuera de asignados',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id],
                    titularId: mockUsers.regularUser2._id // No está en assignedTo
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                mockUserRepository.getById.mockResolvedValue(mockUsers.regularUser1);

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('El titular especificado debe estar en la lista de asignados');
            });

            test('Rechaza si asignados no son del mismo sector', async () => {
                const taskData = {
                    title: 'Asignados de diferentes sectores',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.otherSectorUser._id]
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1)
                    .mockResolvedValueOnce(mockUsers.otherSectorUser);

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('Todos los usuarios asignados deben pertenecer al mismo sector');
            });

            test('Rechaza si usuario asignado no existe', async () => {
                const taskData = {
                    title: 'Usuario inexistente',
                    description: 'Descripción',
                    date: getFutureDate(1),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id, 'inexistente123']
                };
                const creator = {
                    id: mockUsers.supervisor._id,
                    sector: mockUsers.supervisor.sector,
                    isSupervisor: true
                };

                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1)
                    .mockResolvedValueOnce(null); // Usuario no existe

                await expect(taskService.createTask(taskData, creator))
                    .rejects.toThrow('Todos los usuarios asignados deben pertenecer al mismo sector');
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE ACTUALIZACIÓN DE TAREAS
    // ═════════════════════════════════════════════════════════════

    describe('updateTask', () => {
        describe('✅ Casos Exitosos', () => {
            test('Titular puede actualizar campos generales', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea original',
                    description: 'Descripción original',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                const updateData = {
                    title: 'Tarea actualizada',
                    description: 'Nueva descripción'
                };

                const updatedTask = { ...existingTask, ...updateData };

                mockTaskRepository.getById.mockResolvedValue(existingTask);
                mockTaskRepository.updateOne.mockResolvedValue(updatedTask);

                const result = await taskService.updateTask(
                    'task123',
                    updateData,
                    { id: mockUsers.regularUser1._id }
                );

                expect(result.task.title).toBe('Tarea actualizada');
                expect(mockTaskRepository.updateOne).toHaveBeenCalledWith(
                    'task123',
                    expect.objectContaining({ title: 'Tarea actualizada' })
                );
            });

            test('Cualquier asignado puede marcar como completada', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea compartida',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                const updateData = { status: 'COMPLETADA' };
                const updatedTask = { ...existingTask, status: 'COMPLETADA' };

                mockTaskRepository.getById.mockResolvedValue(existingTask);
                mockTaskRepository.updateOne.mockResolvedValue(updatedTask);

                // Usuario 2 (no titular) marca como completada
                const result = await taskService.updateTask(
                    'task123',
                    updateData,
                    { id: mockUsers.regularUser2._id }
                );

                expect(result.task.status).toBe('COMPLETADA');
            });

            test('Permite actualizar assignedTo agregando usuarios', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea individual',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                const updateData = {
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id]
                };

                const updatedTask = {
                    ...existingTask,
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id]
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);
                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1) // titular actual
                    .mockResolvedValueOnce(mockUsers.regularUser2); // nuevo usuario
                mockTaskRepository.updateOne.mockResolvedValue(updatedTask);
                mockUserRepository.getUsersEmails.mockResolvedValue([mockUsers.regularUser2.email]);

                const result = await taskService.updateTask(
                    'task123',
                    updateData,
                    { id: mockUsers.regularUser1._id }
                );

                expect(result.task.assignedTo).toHaveLength(2);
                expect(result.newUsersNotified).toBe(1);
            });

            test('Permite actualizar fechas futuras correctamente', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea con fechas',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                const newDate = getFutureDate(5);
                const newDeadline = getFutureDate(15);
                const updateData = { date: newDate, deadline: newDeadline };

                const updatedTask = { ...existingTask, date: newDate, deadline: newDeadline };

                mockTaskRepository.getById.mockResolvedValue(existingTask);
                mockTaskRepository.updateOne.mockResolvedValue(updatedTask);

                const result = await taskService.updateTask(
                    'task123',
                    updateData,
                    { id: mockUsers.regularUser1._id }
                );

                expect(result.task.date).toEqual(newDate);
                expect(result.task.deadline).toEqual(newDeadline);
            });

            test('Retorna null si tarea no existe', async () => {
                mockTaskRepository.getById.mockResolvedValue(null);

                const result = await taskService.updateTask(
                    'inexistente',
                    { title: 'Nuevo título' },
                    { id: mockUsers.regularUser1._id }
                );

                expect(result).toBeNull();
            });

            test('Permite completar tarea RECURRENTE', async () => {
                const recurringTask = {
                    _id: 'taskRecurring',
                    title: 'Tarea recurrente',
                    date: getFutureDate(2),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE',
                    recurringTaskId: 'recurring123' // Es recurrente
                };

                const updateData = { status: 'COMPLETADA' };
                const updatedTask = { ...recurringTask, status: 'COMPLETADA' };

                mockTaskRepository.getById.mockResolvedValue(recurringTask);
                mockTaskRepository.updateOne.mockResolvedValue(updatedTask);

                const result = await taskService.updateTask(
                    'taskRecurring',
                    updateData,
                    { id: mockUsers.regularUser1._id }
                );

                expect(result.task.status).toBe('COMPLETADA');
            });
        });

        describe('❌ Validaciones y Errores', () => {
            test('Rechaza si no es el titular intentando editar campos generales', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea del usuario 1',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                // Usuario 2 intenta editar (no es titular)
                await expect(taskService.updateTask(
                    'task123',
                    { title: 'Intento de cambio' },
                    { id: mockUsers.regularUser2._id }
                )).rejects.toThrow('Solo el titular de la tarea (posición 0 en asignados) puede editarla');
            });

            test('Rechaza si no es asignado intentando completar', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea privada',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                // Usuario 2 intenta completar (no está asignado)
                await expect(taskService.updateTask(
                    'task123',
                    { status: 'COMPLETADA' },
                    { id: mockUsers.regularUser2._id }
                )).rejects.toThrow('Solo los usuarios asignados a la tarea pueden marcarla como completada');
            });

            test('Rechaza edición de tarea VENCIDA', async () => {
                const expiredTask = {
                    _id: 'taskExpired',
                    title: 'Tarea vencida',
                    date: getPastDate(10),
                    deadline: getPastDate(5),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'VENCIDA'
                };

                mockTaskRepository.getById.mockResolvedValue(expiredTask);

                await expect(taskService.updateTask(
                    'taskExpired',
                    { title: 'Nuevo título' },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('No se pueden editar tareas vencidas');
            });

            test('Rechaza edición de tarea COMPLETADA', async () => {
                const completedTask = {
                    _id: 'taskCompleted',
                    title: 'Tarea completada',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'COMPLETADA'
                };

                mockTaskRepository.getById.mockResolvedValue(completedTask);

                await expect(taskService.updateTask(
                    'taskCompleted',
                    { title: 'Nuevo título' },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('No se pueden editar tareas que ya están completadas');
            });

            test('Rechaza edición de campos generales en tarea RECURRENTE', async () => {
                const recurringTask = {
                    _id: 'taskRecurring',
                    title: 'Tarea recurrente',
                    date: getFutureDate(2),
                    deadline: getFutureDate(5),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE',
                    recurringTaskId: 'recurring123'
                };

                mockTaskRepository.getById.mockResolvedValue(recurringTask);

                await expect(taskService.updateTask(
                    'taskRecurring',
                    { title: 'Cambiar título de recurrente' },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('No se pueden editar tareas recurrentes. Modifique la tarea recurrente original.');
            });

            test('Rechaza si titular intenta quitarse de assignedTo', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea compartida',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                // Titular intenta quitarse
                await expect(taskService.updateTask(
                    'task123',
                    { assignedTo: [mockUsers.regularUser2._id] }, // Sin el titular
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('El titular de la tarea (posición 0) no puede ser removido de los asignados');
            });

            test('Rechaza si titular deja de estar en posición 0', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea compartida',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                // Cambiar orden, poniendo usuario2 primero
                await expect(taskService.updateTask(
                    'task123',
                    { assignedTo: [mockUsers.regularUser2._id, mockUsers.regularUser1._id] },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('El titular de la tarea debe permanecer en la posición 0 de los asignados');
            });

            test('Rechaza actualización con date anterior al momento actual', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea para actualizar',
                    date: getFutureDate(5),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                await expect(taskService.updateTask(
                    'task123',
                    { date: getPastDate(2) },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('La fecha de inicio no puede ser anterior al momento actual de modificación');
            });

            test('Rechaza actualización con deadline anterior al momento actual', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea para actualizar',
                    date: getFutureDate(5),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                await expect(taskService.updateTask(
                    'task123',
                    { deadline: getPastDate(2) },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('La fecha de vencimiento no puede ser anterior al momento actual de modificación');
            });

            test('Rechaza si nueva deadline es anterior a nueva date', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea para actualizar',
                    date: getFutureDate(5),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                await expect(taskService.updateTask(
                    'task123',
                    { date: getFutureDate(15), deadline: getFutureDate(10) },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('La fecha de vencimiento (deadline) debe ser igual o posterior a la fecha de la tarea (date)');
            });

            test('Rechaza actualización sin cambios en assignedTo', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea sin cambios',
                    date: getFutureDate(5),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);
                mockUserRepository.getById.mockResolvedValue(mockUsers.regularUser1);

                // Mismo array de asignados, sin cambios reales
                await expect(taskService.updateTask(
                    'task123',
                    { assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id] },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('No hay cambios para guardar');
            });

            test('Rechaza actualización de assignedTo con usuario de otro sector', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea individual',
                    date: getFutureDate(5),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);
                mockUserRepository.getById
                    .mockResolvedValueOnce(mockUsers.regularUser1)
                    .mockResolvedValueOnce(mockUsers.otherSectorUser);

                await expect(taskService.updateTask(
                    'task123',
                    { assignedTo: [mockUsers.regularUser1._id, mockUsers.otherSectorUser._id] },
                    { id: mockUsers.regularUser1._id }
                )).rejects.toThrow('Todos los usuarios asignados deben pertenecer al mismo sector');
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE ELIMINACIÓN DE TAREAS
    // ═════════════════════════════════════════════════════════════

    describe('deleteTask', () => {
        describe('✅ Casos Exitosos', () => {
            test('Titular puede eliminar tarea PENDIENTE con deadline futuro', async () => {
                const taskToDelete = {
                    _id: 'task123',
                    title: 'Tarea a eliminar',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(taskToDelete);
                mockTaskRepository.deleteOne.mockResolvedValue(true);

                const result = await taskService.deleteTask('task123', mockUsers.regularUser1._id);

                expect(result).toEqual(taskToDelete);
                expect(mockTaskRepository.deleteOne).toHaveBeenCalledWith('task123');
            });
        });

        describe('❌ Validaciones y Errores', () => {
            test('Rechaza si no es el titular', async () => {
                const existingTask = {
                    _id: 'task123',
                    title: 'Tarea ajena',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(existingTask);

                // Usuario 2 intenta eliminar (no es titular)
                await expect(taskService.deleteTask('task123', mockUsers.regularUser2._id))
                    .rejects.toThrow('Solo el titular de la tarea (posición 0 en asignados) puede eliminarla');
            });

            test('Rechaza eliminar tarea COMPLETADA', async () => {
                const completedTask = {
                    _id: 'task123',
                    title: 'Tarea completada',
                    date: getFutureDate(2),
                    deadline: getFutureDate(10),
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'COMPLETADA'
                };

                mockTaskRepository.getById.mockResolvedValue(completedTask);

                await expect(taskService.deleteTask('task123', mockUsers.regularUser1._id))
                    .rejects.toThrow('No se pueden eliminar tareas que ya están completadas');
            });

            test('Rechaza eliminar tarea con deadline vencido', async () => {
                const expiredDeadlineTask = {
                    _id: 'task123',
                    title: 'Tarea con deadline vencido',
                    date: getPastDate(10),
                    deadline: getPastDate(2), // Vencido
                    assignedTo: [mockUsers.regularUser1._id],
                    createdBy: mockUsers.regularUser1._id,
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(expiredDeadlineTask);

                await expect(taskService.deleteTask('task123', mockUsers.regularUser1._id))
                    .rejects.toThrow('Solo se pueden eliminar tareas con fecha de vencimiento futura');
            });

            test('Retorna null si tarea no existe', async () => {
                mockTaskRepository.getById.mockResolvedValue(null);

                const result = await taskService.deleteTask('inexistente', mockUsers.regularUser1._id);

                expect(result).toBeNull();
                expect(mockTaskRepository.deleteOne).not.toHaveBeenCalled();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE OPERACIONES DE LECTURA
    // ═════════════════════════════════════════════════════════════

    describe('Operaciones de lectura', () => {
        describe('getAllTasks', () => {
            test('Retorna array de tareas', async () => {
                const tasks = [
                    { _id: 'task1', title: 'Tarea 1' },
                    { _id: 'task2', title: 'Tarea 2' }
                ];

                mockTaskRepository.getAll.mockResolvedValue(tasks);

                const result = await taskService.getAllTasks();

                expect(result).toHaveLength(2);
                expect(result).toEqual(tasks);
            });

            test('Retorna array vacío si no hay tareas', async () => {
                mockTaskRepository.getAll.mockResolvedValue([]);

                const result = await taskService.getAllTasks();

                expect(result).toEqual([]);
            });

            test('Retorna array vacío si repositorio retorna null', async () => {
                mockTaskRepository.getAll.mockResolvedValue(null);

                const result = await taskService.getAllTasks();

                expect(result).toEqual([]);
            });
        });

        describe('getTaskById', () => {
            test('Retorna tarea si existe', async () => {
                const task = {
                    _id: 'task123',
                    title: 'Tarea de prueba',
                    status: 'PENDIENTE'
                };

                mockTaskRepository.getById.mockResolvedValue(task);

                const result = await taskService.getTaskById('task123');

                expect(result).toEqual(task);
                expect(mockTaskRepository.getById).toHaveBeenCalledWith('task123');
            });

            test('Retorna null si no existe', async () => {
                mockTaskRepository.getById.mockResolvedValue(null);

                const result = await taskService.getTaskById('inexistente');

                expect(result).toBeNull();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE VALIDACIONES PRIVADAS
    // ═════════════════════════════════════════════════════════════

    describe('Validaciones privadas', () => {
        describe('_validateCanEdit', () => {
            test('Permite al titular editar campos generales', () => {
                const task = {
                    assignedTo: [mockUsers.regularUser1._id],
                    status: 'PENDIENTE'
                };

                expect(() => taskService._validateCanEdit(
                    task,
                    mockUsers.regularUser1._id,
                    false
                )).not.toThrow();
            });

            test('Permite a cualquier asignado completar', () => {
                const task = {
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    status: 'PENDIENTE'
                };

                expect(() => taskService._validateCanEdit(
                    task,
                    mockUsers.regularUser2._id,
                    true // solo completar
                )).not.toThrow();
            });

            test('Rechaza a no-titular para edición general', () => {
                const task = {
                    assignedTo: [mockUsers.regularUser1._id, mockUsers.regularUser2._id],
                    status: 'PENDIENTE'
                };

                expect(() => taskService._validateCanEdit(
                    task,
                    mockUsers.regularUser2._id,
                    false
                )).toThrow('Solo el titular de la tarea (posición 0 en asignados) puede editarla');
            });

            test('Rechaza a no-asignado para completar', () => {
                const task = {
                    assignedTo: [mockUsers.regularUser1._id],
                    status: 'PENDIENTE'
                };

                expect(() => taskService._validateCanEdit(
                    task,
                    mockUsers.regularUser2._id,
                    true
                )).toThrow('Solo los usuarios asignados a la tarea pueden marcarla como completada');
            });
        });

        describe('_validateCanDelete', () => {
            test('Permite al titular eliminar tarea pendiente con deadline futuro', () => {
                const task = {
                    assignedTo: [mockUsers.regularUser1._id],
                    status: 'PENDIENTE',
                    deadline: getFutureDate(10)
                };

                expect(() => taskService._validateCanDelete(
                    task,
                    mockUsers.regularUser1._id
                )).not.toThrow();
            });

            test('Rechaza eliminación por no-titular', () => {
                const task = {
                    assignedTo: [mockUsers.regularUser1._id],
                    status: 'PENDIENTE',
                    deadline: getFutureDate(10)
                };

                expect(() => taskService._validateCanDelete(
                    task,
                    mockUsers.regularUser2._id
                )).toThrow('Solo el titular de la tarea (posición 0 en asignados) puede eliminarla');
            });
        });

        describe('_validateUpdateDatesNotInPast', () => {
            test('Acepta fechas futuras', () => {
                expect(() => taskService._validateUpdateDatesNotInPast(
                    getFutureDate(5),
                    getFutureDate(10)
                )).not.toThrow();
            });

            test('Rechaza date pasada', () => {
                expect(() => taskService._validateUpdateDatesNotInPast(
                    getPastDate(5),
                    getFutureDate(10)
                )).toThrow('La fecha de inicio no puede ser anterior al momento actual de modificación');
            });

            test('Rechaza deadline pasada', () => {
                expect(() => taskService._validateUpdateDatesNotInPast(
                    getFutureDate(5),
                    getPastDate(1)
                )).toThrow('La fecha de vencimiento no puede ser anterior al momento actual de modificación');
            });

            test('No valida si fechas son undefined', () => {
                expect(() => taskService._validateUpdateDatesNotInPast(
                    undefined,
                    undefined
                )).not.toThrow();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE OPERACIONES DE CALENDARIO
    // ═════════════════════════════════════════════════════════════

    describe('getCalendarTasks', () => {
        test('Obtiene tareas para usuario regular', async () => {
            const user = {
                id: mockUsers.regularUser1._id,
                sector: mockUsers.regularUser1.sector,
                isSupervisor: false
            };

            const tasks = [
                { _id: 'task1', title: 'Tarea 1' }
            ];

            mockTaskRepository.getByDateRangeAndUsers.mockResolvedValue(tasks);

            const result = await taskService.getCalendarTasks(user, 1, 2025);

            expect(mockTaskRepository.getByDateRangeAndUsers).toHaveBeenCalledWith(
                expect.any(Date),
                expect.any(Date),
                [user.id]
            );
            expect(result).toEqual(tasks);
        });

        test('Supervisor obtiene tareas de todo el sector', async () => {
            const supervisor = {
                id: mockUsers.supervisor._id,
                sector: mockUsers.supervisor.sector,
                isSupervisor: true
            };

            const usersInSector = [
                { _id: mockUsers.regularUser1._id },
                { _id: mockUsers.regularUser2._id }
            ];

            mockUserRepository.getBySector.mockResolvedValue(usersInSector);
            mockTaskRepository.getByDateRangeAndUsers.mockResolvedValue([]);

            await taskService.getCalendarTasks(supervisor, 1, 2025);

            expect(mockUserRepository.getBySector).toHaveBeenCalledWith(supervisor.sector);
            expect(mockTaskRepository.getByDateRangeAndUsers).toHaveBeenCalledWith(
                expect.any(Date),
                expect.any(Date),
                expect.arrayContaining([
                    mockUsers.regularUser1._id,
                    mockUsers.regularUser2._id
                ])
            );
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE MARCADO DE TAREAS VENCIDAS
    // ═════════════════════════════════════════════════════════════

    describe('markExpiredTasks', () => {
        test('Marca tareas vencidas correctamente', async () => {
            mockTaskRepository.markExpiredTasks.mockResolvedValue({ modifiedCount: 3 });

            const result = await taskService.markExpiredTasks();

            expect(result).toEqual({ modifiedCount: 3 });
            expect(mockTaskRepository.markExpiredTasks).toHaveBeenCalledWith(expect.any(Date));
        });

        test('Retorna 0 si no hay tareas vencidas', async () => {
            mockTaskRepository.markExpiredTasks.mockResolvedValue({ modifiedCount: 0 });

            const result = await taskService.markExpiredTasks();

            expect(result).toEqual({ modifiedCount: 0 });
        });
    });
});
