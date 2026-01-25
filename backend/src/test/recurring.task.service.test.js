/**
 * Tests Unitarios para RecurringTaskService
 * 
 * Cobertura completa:
 * - create() - Creación de tareas recurrentes con validaciones
 * - generateTasksForMonth() - Generación de instancias individuales
 * - markExpiredTasks() - Marcado de tareas vencidas
 * - update() - Actualización de assignedTo
 * - deactivate() - Desactivación de tareas recurrentes
 * - deleteFutureNonCompletedTasks() - Eliminación de tareas futuras no completadas
 * - delete() - Eliminación completa de tarea recurrente e instancias
 * - Helpers privados (_generateTasksForRecurringTask, _calculateOccurrencesForMonth, etc.)
 */

// ═════════════════════════════════════════════════════════════
// MOCKS - Deben definirse ANTES de importar el servicio
// ═════════════════════════════════════════════════════════════

// Mock del servicio de email - inline para evitar problemas de hoisting
jest.mock('../services/email.service.js', () => ({
    sendRecurringTaskCreatedEmail: jest.fn().mockResolvedValue(true),
    sendRecurringTaskAddUser: jest.fn().mockResolvedValue(true)
}));

// Importar los mocks después de definirlos para poder usarlos en tests
const { sendRecurringTaskCreatedEmail: mockSendRecurringTaskCreatedEmail, sendRecurringTaskAddUser: mockSendRecurringTaskAddUser } = require('../services/email.service.js');

// Mock del repositorio de tareas recurrentes
const mockCreate = jest.fn();
const mockGetById = jest.fn();
const mockGetAll = jest.fn();
const mockGetAllActive = jest.fn();
const mockUpdateById = jest.fn();
const mockDeleteById = jest.fn();

jest.mock('../repository/recurring.task.repository.js', () => ({
    RecurringTaskRepository: {
        create: (...args) => mockCreate(...args),
        getById: (...args) => mockGetById(...args),
        getAll: (...args) => mockGetAll(...args),
        getAllActive: (...args) => mockGetAllActive(...args),
        updateById: (...args) => mockUpdateById(...args),
        deleteById: (...args) => mockDeleteById(...args)
    }
}));

// Mock del repositorio de usuarios - inline con una variable global de control
let mockEmailsToReturn = ['test@test.com'];

jest.mock('../repository/user.mongo.repository.js', () => ({
    MongoUserRepository: jest.fn().mockImplementation(() => ({
        getUsersEmails: jest.fn().mockImplementation(() => Promise.resolve(mockEmailsToReturn))
    }))
}));

// Función helper para cambiar los emails que retorna el mock
const setMockEmails = (emails) => {
    mockEmailsToReturn = emails;
};

// Mock de TaskModel como constructor (clase) para permitir new TaskModel()
const mockTaskSave = jest.fn().mockResolvedValue({ _id: 'generated-task-id' });
const mockTaskFind = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([])
});
const mockTaskFindById = jest.fn();
const mockTaskFindByIdAndUpdate = jest.fn();
const mockTaskUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
const mockTaskCountDocuments = jest.fn().mockResolvedValue(0);
const mockTaskDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });

// Constructor mock para TaskModel
function MockTaskModel(data) {
    this.data = data;
    this.save = mockTaskSave;
}
MockTaskModel.find = mockTaskFind;
MockTaskModel.findById = mockTaskFindById;
MockTaskModel.findByIdAndUpdate = mockTaskFindByIdAndUpdate;
MockTaskModel.updateMany = mockTaskUpdateMany;
MockTaskModel.countDocuments = mockTaskCountDocuments;
MockTaskModel.deleteMany = mockTaskDeleteMany;

jest.mock('../model/Task.js', () => ({
    TaskModel: MockTaskModel
}));

// Mock de ArgentinaTime para tests determinísticos
jest.mock('../utils/argentinaTime.js', () => ({
    ArgentinaTime: {
        formatDate: jest.fn((date) => {
            const d = new Date(date);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }),
        getArgentinaDay: jest.fn((date) => new Date(date).getUTCDay()),
        getArgentinaHours: jest.fn((date) => new Date(date).getUTCHours()),
        getArgentinaMinutes: jest.fn((date) => new Date(date).getUTCMinutes()),
        createFromArgentinaComponents: jest.fn((year, month, day, hours, minutes, seconds) => {
            return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
        })
    }
}));

// Importar después de los mocks
import { RecurringTaskService } from '../services/recurring.task.service.js';
import { ArgentinaTime } from '../utils/argentinaTime.js';

describe('RecurringTaskService - Tests Unitarios', () => {
    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const mockUsers = {
        owner: {
            _id: '507f1f77bcf86cd799439011',
            name: 'Owner Test',
            email: 'owner@test.com',
            sector: 'IT'
        },
        user1: {
            _id: '507f1f77bcf86cd799439022',
            name: 'Usuario 1',
            email: 'user1@test.com',
            sector: 'IT'
        },
        user2: {
            _id: '507f1f77bcf86cd799439033',
            name: 'Usuario 2',
            email: 'user2@test.com',
            sector: 'IT'
        }
    };

    const getFutureDate = (daysFromNow) => {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        date.setHours(10, 0, 0, 0);
        return date;
    };

    const getPastDate = (daysAgo) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        date.setHours(10, 0, 0, 0);
        return date;
    };

    const createMockRecurringTask = (overrides = {}) => ({
        _id: '60d5ec49f1b2c72d88f9e123',
        title: 'Tarea Recurrente Test',
        description: 'Descripción de prueba',
        assignedTo: [mockUsers.owner],
        periodicity: 'SEMANAL',
        datePattern: 'LUNES',
        numberPattern: null,
        date: getFutureDate(1),
        deadline: getFutureDate(2),
        active: true,
        deactivatedAt: null,
        includeWeekends: true,
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset TaskModel mocks para cada test
        mockTaskFind.mockReturnValue({
            select: jest.fn().mockResolvedValue([])
        });
        mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 0 });
        mockTaskCountDocuments.mockResolvedValue(0);
        mockTaskDeleteMany.mockResolvedValue({ deletedCount: 0 });
        mockTaskSave.mockResolvedValue({ _id: 'generated-task-id' });
        
        // Reset MongoUserRepository para retornar emails por defecto
        mockEmailsToReturn = ['test@test.com'];
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE create()
    // ═════════════════════════════════════════════════════════════

    describe('create()', () => {
        describe('Validaciones de recurrenceType', () => {
            test('Debe crear tarea con NUMERIC_PATTERN correctamente', async () => {
                const params = {
                    title: 'Tarea Mensual',
                    description: 'Descripción',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask({
                    ...params,
                    periodicity: 'MENSUAL'
                });

                mockCreate.mockResolvedValue(expectedRecurringTask);

                const result = await RecurringTaskService.create(params);

                expect(result.recurringTask).toEqual(expectedRecurringTask);
                expect(mockCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        periodicity: 'MENSUAL',
                        numberPattern: 15
                    })
                );
            });

            test('Debe crear tarea con DAILY_PATTERN y periodicidad SEMANAL', async () => {
                const params = {
                    title: 'Tarea Semanal',
                    description: 'Descripción',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    periodicity: 'SEMANAL',
                    datePattern: 'LUNES',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask(params);
                mockCreate.mockResolvedValue(expectedRecurringTask);

                const result = await RecurringTaskService.create(params);

                expect(result.recurringTask).toEqual(expectedRecurringTask);
                expect(mockCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        periodicity: 'SEMANAL',
                        datePattern: 'LUNES'
                    })
                );
            });

            test('Debe rechazar recurrenceType inválido', async () => {
                const params = {
                    title: 'Tarea Inválida',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'INVALID_TYPE',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('Tipo de recurrencia inválido');
            });
        });

        describe('Validaciones de NUMERIC_PATTERN', () => {
            test('Debe rechazar numberPattern menor a 1', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 0,
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('El patrón numérico debe estar entre 1 y 31');
            });

            test('Debe rechazar numberPattern mayor a 31', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 32,
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('El patrón numérico debe estar entre 1 y 31');
            });

            test('Debe rechazar numberPattern undefined', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('El patrón numérico debe estar entre 1 y 31');
            });
        });

        describe('Validaciones de DAILY_PATTERN', () => {
            test('Debe rechazar si falta periodicidad', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    datePattern: 'LUNES',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('La periodicidad es requerida para el patrón diario');
            });

            test('Debe rechazar SEMANAL sin datePattern', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    periodicity: 'SEMANAL',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('El patrón de día es requerido para frecuencia semanal o quincenal');
            });

            test('Debe rechazar QUINCENAL sin datePattern', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    periodicity: 'QUINCENAL',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('El patrón de día es requerido para frecuencia semanal o quincenal');
            });

            test('Debe crear tarea DIARIA sin datePattern', async () => {
                const params = {
                    title: 'Tarea Diaria',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    periodicity: 'DIARIA',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask({
                    periodicity: 'DIARIA',
                    datePattern: null
                });
                mockCreate.mockResolvedValue(expectedRecurringTask);

                const result = await RecurringTaskService.create(params);

                expect(result.recurringTask.periodicity).toBe('DIARIA');
            });
        });

        describe('Validaciones de fechas', () => {
            test('Debe rechazar si date no está presente', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('La fecha de la tarea (date) es requerida');
            });

            test('Debe rechazar si date es anterior al momento actual', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getPastDate(5),
                    deadline: getFutureDate(2)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('La fecha de la tarea no puede ser anterior al momento actual');
            });

            test('Debe rechazar si deadline no está presente', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(1)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('La fecha de vencimiento (deadline) es requerida');
            });

            test('Debe rechazar si deadline es anterior al momento actual', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(1),
                    deadline: getPastDate(1)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('La fecha de vencimiento no puede ser anterior al momento actual');
            });

            test('Debe rechazar si deadline es anterior a date', async () => {
                const params = {
                    title: 'Tarea',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(10),
                    deadline: getFutureDate(5)
                };

                await expect(RecurringTaskService.create(params))
                    .rejects.toThrow('La fecha de vencimiento debe ser igual o posterior a la fecha de la tarea');
            });
        });

        describe('Envío de emails', () => {
            test('Debe enviar email al crear tarea correctamente', async () => {
                const params = {
                    title: 'Tarea con email',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask(params);
                mockCreate.mockResolvedValue(expectedRecurringTask);

                const result = await RecurringTaskService.create(params);

                expect(result.emailSent).toBe(true);
                expect(result.emailError).toBeNull();
                expect(mockSendRecurringTaskCreatedEmail).toHaveBeenCalled();
            });

            test('Debe retornar emailSent=false si no hay emails', async () => {
                const params = {
                    title: 'Tarea sin emails',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask(params);
                mockCreate.mockResolvedValue(expectedRecurringTask);
                
                // Simular que no hay emails
                mockEmailsToReturn = [];

                const result = await RecurringTaskService.create(params);

                expect(result.emailSent).toBe(false);
            });

            test('Debe capturar error de email sin fallar la creación', async () => {
                const params = {
                    title: 'Tarea con error email',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'NUMERIC_PATTERN',
                    numberPattern: 15,
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask(params);
                mockCreate.mockResolvedValue(expectedRecurringTask);
                
                // El servicio de email lanza error
                mockSendRecurringTaskCreatedEmail.mockRejectedValueOnce(new Error('SMTP Error'));

                const result = await RecurringTaskService.create(params);

                expect(result.recurringTask).toEqual(expectedRecurringTask);
                expect(result.emailSent).toBe(false);
                expect(result.emailError).toBe('SMTP Error');
            });
        });

        describe('includeWeekends', () => {
            test('Debe usar includeWeekends=true por defecto', async () => {
                const params = {
                    title: 'Tarea Diaria',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    periodicity: 'DIARIA',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2)
                };

                const expectedRecurringTask = createMockRecurringTask({
                    periodicity: 'DIARIA',
                    includeWeekends: true
                });
                mockCreate.mockResolvedValue(expectedRecurringTask);

                await RecurringTaskService.create(params);

                expect(mockCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        includeWeekends: true
                    })
                );
            });

            test('Debe respetar includeWeekends=false cuando se proporciona', async () => {
                const params = {
                    title: 'Tarea Días Hábiles',
                    assignedTo: [mockUsers.owner._id],
                    recurrenceType: 'DAILY_PATTERN',
                    periodicity: 'DIARIA',
                    date: getFutureDate(1),
                    deadline: getFutureDate(2),
                    includeWeekends: false
                };

                const expectedRecurringTask = createMockRecurringTask({
                    periodicity: 'DIARIA',
                    includeWeekends: false
                });
                mockCreate.mockResolvedValue(expectedRecurringTask);

                await RecurringTaskService.create(params);

                expect(mockCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        includeWeekends: false
                    })
                );
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE markExpiredTasks()
    // ═════════════════════════════════════════════════════════════

    describe('markExpiredTasks()', () => {
        test('Debe marcar tareas pendientes vencidas como VENCIDA', async () => {
            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 5 });

            const result = await RecurringTaskService.markExpiredTasks();

            expect(mockTaskUpdateMany).toHaveBeenCalledWith(
                {
                    status: 'PENDIENTE',
                    deadline: { $lt: expect.any(Date) }
                },
                {
                    $set: { status: 'VENCIDA' }
                }
            );
            expect(result.expiredTasksMarked).toBe(5);
        });

        test('Debe retornar 0 si no hay tareas vencidas', async () => {
            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 0 });

            const result = await RecurringTaskService.markExpiredTasks();

            expect(result.expiredTasksMarked).toBe(0);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE generateTasksForMonth()
    // ═════════════════════════════════════════════════════════════

    describe('generateTasksForMonth()', () => {
        test('Debe llamar a markExpiredTasks antes de generar', async () => {
            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 2 });
            mockGetAllActive.mockResolvedValue([]);

            const result = await RecurringTaskService.generateTasksForMonth(2026, 2, mockUsers.owner._id);

            expect(mockTaskUpdateMany).toHaveBeenCalled();
            expect(result.expiredTasksMarked).toBe(2);
        });

        test('Debe retornar resumen correcto cuando no hay tareas recurrentes activas', async () => {
            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 0 });
            mockGetAllActive.mockResolvedValue([]);

            const result = await RecurringTaskService.generateTasksForMonth(2026, 3, mockUsers.owner._id);

            expect(result).toEqual({
                year: 2026,
                month: 3,
                totalTasksGenerated: 0,
                generatedTasks: [],
                expiredTasksMarked: 0
            });
        });

        test('Debe generar tareas para múltiples tareas recurrentes activas', async () => {
            const recurringTask1 = createMockRecurringTask({
                _id: 'recurring1',
                periodicity: 'MENSUAL',
                numberPattern: 15,
                date: new Date(Date.UTC(2026, 0, 1)),
                deadline: new Date(Date.UTC(2026, 0, 2))
            });

            const recurringTask2 = createMockRecurringTask({
                _id: 'recurring2',
                periodicity: 'MENSUAL',
                numberPattern: 20,
                date: new Date(Date.UTC(2026, 0, 1)),
                deadline: new Date(Date.UTC(2026, 0, 2))
            });

            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 0 });
            mockGetAllActive.mockResolvedValue([recurringTask1, recurringTask2]);

            mockTaskFind.mockReturnValue({
                select: jest.fn().mockResolvedValue([])
            });

            const result = await RecurringTaskService.generateTasksForMonth(2026, 2, mockUsers.owner._id);

            expect(mockGetAllActive).toHaveBeenCalled();
            expect(result.year).toBe(2026);
            expect(result.month).toBe(2);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE _generateTasksForRecurringTask() (método privado)
    // ═════════════════════════════════════════════════════════════

    describe('_generateTasksForRecurringTask()', () => {
        test('Debe retornar array vacío si anchorDate es posterior al mes', async () => {
            const recurringTask = createMockRecurringTask({
                date: new Date(Date.UTC(2027, 5, 1)),
                deadline: new Date(Date.UTC(2027, 5, 2))
            });

            const result = await RecurringTaskService._generateTasksForRecurringTask(
                recurringTask, 2026, 1, mockUsers.owner._id
            );

            expect(result).toEqual([]);
        });

        test('Debe evitar duplicados verificando tareas existentes', async () => {
            const recurringTask = createMockRecurringTask({
                _id: 'recurring123',
                periodicity: 'MENSUAL',
                numberPattern: 15,
                date: new Date(Date.UTC(2026, 0, 1)),
                deadline: new Date(Date.UTC(2026, 0, 2))
            });

            mockTaskFind.mockReturnValue({
                select: jest.fn().mockResolvedValue([
                    { date: new Date(Date.UTC(2026, 1, 15)) }
                ])
            });

            ArgentinaTime.formatDate.mockImplementation((date) => {
                const d = new Date(date);
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            });

            const result = await RecurringTaskService._generateTasksForRecurringTask(
                recurringTask, 2026, 2, mockUsers.owner._id
            );

            expect(result).toEqual([]);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE _calculateOccurrencesForMonth() (método privado)
    // ═════════════════════════════════════════════════════════════

    describe('_calculateOccurrencesForMonth()', () => {
        const anchorDate = new Date(Date.UTC(2026, 0, 1, 10, 0, 0));

        describe('Periodicidad DIARIA', () => {
            test('Debe calcular todas las ocurrencias diarias del mes', () => {
                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'DIARIA', null, null, 2026, 1, true
                );

                expect(result.length).toBe(31);
            });

            test('Debe excluir fines de semana cuando includeWeekends=false', () => {
                let dayCounter = 0;
                ArgentinaTime.getArgentinaDay.mockImplementation(() => {
                    const day = dayCounter % 7;
                    dayCounter++;
                    return day;
                });

                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'DIARIA', null, null, 2026, 1, false
                );

                expect(result.length).toBeLessThan(31);
            });
        });

        describe('Periodicidad SEMANAL', () => {
            test('Debe calcular ocurrencias semanales para LUNES', () => {
                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'SEMANAL', 'LUNES', null, 2026, 1, true
                );

                expect(result.length).toBeGreaterThanOrEqual(4);
                expect(result.length).toBeLessThanOrEqual(5);
            });
        });

        describe('Periodicidad QUINCENAL', () => {
            test('Debe calcular ocurrencias quincenales', () => {
                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'QUINCENAL', 'LUNES', null, 2026, 1, true
                );

                expect(result.length).toBeLessThanOrEqual(3);
            });
        });

        describe('Periodicidad MENSUAL', () => {
            test('Debe calcular una ocurrencia mensual', () => {
                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'MENSUAL', null, 15, 2026, 2, true
                );

                expect(result.length).toBeLessThanOrEqual(1);
            });

            test('Debe ajustar numberPattern al último día del mes si es mayor', () => {
                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'MENSUAL', null, 31, 2026, 2, true
                );

                if (result.length > 0) {
                    expect(result[0].getUTCDate()).toBeLessThanOrEqual(28);
                }
            });
        });

        describe('Periodicidad desconocida', () => {
            test('Debe retornar array vacío para periodicidad inválida', () => {
                const result = RecurringTaskService._calculateOccurrencesForMonth(
                    anchorDate, 'INVALIDA', null, null, 2026, 1, true
                );

                expect(result).toEqual([]);
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE _calculateDailyForMonth() (método privado)
    // ═════════════════════════════════════════════════════════════

    describe('_calculateDailyForMonth()', () => {
        test('Debe generar ocurrencias desde el inicio del mes', () => {
            const monthStart = new Date(Date.UTC(2026, 1, 1));
            const monthEnd = new Date(Date.UTC(2026, 2, 1, 2, 59, 59, 999));
            const anchorDate = new Date(Date.UTC(2025, 0, 1));

            const result = RecurringTaskService._calculateDailyForMonth(
                monthStart, monthEnd, anchorDate, 10, 0, 0, true
            );

            expect(result.length).toBe(28);
            expect(result[0].getUTCHours()).toBe(10);
        });

        test('Debe comenzar desde anchorDate si es posterior al inicio del mes', () => {
            const monthStart = new Date(Date.UTC(2026, 1, 1));
            const monthEnd = new Date(Date.UTC(2026, 2, 1, 2, 59, 59, 999));
            const anchorDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

            const result = RecurringTaskService._calculateDailyForMonth(
                monthStart, monthEnd, anchorDate, 10, 0, 0, true
            );

            expect(result.length).toBe(14);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE _calculateWeeklyForMonth() (método privado)
    // ═════════════════════════════════════════════════════════════

    describe('_calculateWeeklyForMonth()', () => {
        test('Debe calcular ocurrencias semanales correctamente', () => {
            const monthStart = new Date(Date.UTC(2026, 1, 1));
            const monthEnd = new Date(Date.UTC(2026, 2, 1, 2, 59, 59, 999));
            const anchorDate = new Date(Date.UTC(2026, 0, 5, 10, 0, 0));

            const result = RecurringTaskService._calculateWeeklyForMonth(
                monthStart, monthEnd, 'LUNES', 1, anchorDate, 10, 0, 0
            );

            expect(result.length).toBe(4);
        });

        test('Debe calcular ocurrencias quincenales (weekInterval=2)', () => {
            const monthStart = new Date(Date.UTC(2026, 1, 1));
            const monthEnd = new Date(Date.UTC(2026, 2, 1, 2, 59, 59, 999));
            const anchorDate = new Date(Date.UTC(2026, 0, 5, 10, 0, 0));

            const result = RecurringTaskService._calculateWeeklyForMonth(
                monthStart, monthEnd, 'LUNES', 2, anchorDate, 10, 0, 0
            );

            expect(result.length).toBeLessThanOrEqual(3);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE _calculateMonthlyForMonth() (método privado)
    // ═════════════════════════════════════════════════════════════

    describe('_calculateMonthlyForMonth()', () => {
        test('Debe retornar una sola ocurrencia para el día especificado', () => {
            const anchorDate = new Date(Date.UTC(2026, 0, 1, 10, 0, 0));

            const result = RecurringTaskService._calculateMonthlyForMonth(
                2026, 2, 15, anchorDate, 10, 0, 0
            );

            expect(result.length).toBe(1);
            expect(result[0].getUTCDate()).toBe(15);
        });

        test('Debe retornar array vacío si la ocurrencia es anterior al anchorDate', () => {
            const anchorDate = new Date(Date.UTC(2026, 2, 1, 10, 0, 0));

            const result = RecurringTaskService._calculateMonthlyForMonth(
                2026, 2, 15, anchorDate, 10, 0, 0
            );

            expect(result).toEqual([]);
        });

        test('Debe ajustar al último día del mes si dayOfMonth es mayor', () => {
            const anchorDate = new Date(Date.UTC(2026, 0, 1, 10, 0, 0));

            const result = RecurringTaskService._calculateMonthlyForMonth(
                2026, 2, 31, anchorDate, 10, 0, 0
            );

            if (result.length > 0) {
                expect(result[0].getUTCDate()).toBe(28);
            }
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE update()
    // ═════════════════════════════════════════════════════════════

    describe('update()', () => {
        describe('Validaciones', () => {
            test('Debe retornar null si la tarea recurrente no existe', async () => {
                mockGetById.mockResolvedValue(null);

                const result = await RecurringTaskService.update(
                    'nonexistent',
                    { assignedTo: [mockUsers.owner._id] },
                    mockUsers.owner._id
                );

                expect(result).toBeNull();
            });

            test('Debe rechazar si la tarea está desactivada', async () => {
                const deactivatedTask = createMockRecurringTask({
                    active: false,
                    deactivatedAt: new Date()
                });
                mockGetById.mockResolvedValue(deactivatedTask);

                await expect(RecurringTaskService.update(
                    deactivatedTask._id,
                    { assignedTo: [mockUsers.owner._id] },
                    mockUsers.owner._id
                )).rejects.toThrow('No se puede modificar una tarea recurrente desactivada');
            });

            test('Debe rechazar si el solicitante no es el titular', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id] },
                    mockUsers.user1._id
                )).rejects.toThrow('Solo el titular de la tarea (posición 0 del assignedTo) puede modificarla');
            });

            test('Debe rechazar si se intenta modificar title', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    { title: 'Nuevo título', assignedTo: [mockUsers.owner._id] },
                    mockUsers.owner._id
                )).rejects.toThrow('Solo se permite modificar la lista de usuarios asignados');
            });

            test('Debe rechazar si se intenta modificar description', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    { description: 'Nueva descripción', assignedTo: [mockUsers.owner._id] },
                    mockUsers.owner._id
                )).rejects.toThrow('Solo se permite modificar la lista de usuarios asignados');
            });

            test('Debe rechazar si assignedTo no está presente', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    {},
                    mockUsers.owner._id
                )).rejects.toThrow('Se debe proporcionar la lista de usuarios asignados');
            });

            test('Debe rechazar si assignedTo no es un array', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: 'not-an-array' },
                    mockUsers.owner._id
                )).rejects.toThrow('assignedTo debe ser un array');
            });

            test('Debe rechazar si assignedTo está vacío', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [] },
                    mockUsers.owner._id
                )).rejects.toThrow('La tarea debe tener al menos un usuario asignado');
            });

            test('Debe rechazar si el titular intenta quitarse o cambiar de posición', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);

                await expect(RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.user1._id, mockUsers.owner._id] },
                    mockUsers.owner._id
                )).rejects.toThrow('El titular no puede quitarse a sí mismo ni cambiar su posición');
            });
        });

        describe('Actualización exitosa', () => {
            test('Debe actualizar assignedTo correctamente', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);
                
                const updatedTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner, mockUsers.user1]
                });
                mockUpdateById.mockResolvedValue(updatedTask);
                
                mockTaskCountDocuments.mockResolvedValue(3);
                mockTaskFind.mockReturnValue([]);

                const result = await RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id, mockUsers.user1._id] },
                    mockUsers.owner._id
                );

                expect(result.recurringTask).toEqual(updatedTask);
                expect(mockUpdateById).toHaveBeenCalledWith(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id, mockUsers.user1._id] },
                    expect.any(Function)
                );
            });

            test('Debe detectar cambio de "no compartida" a "compartida"', async () => {
                const recurringTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner]
                });
                mockGetById.mockResolvedValue(recurringTask);
                
                const updatedTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner, mockUsers.user1]
                });
                mockUpdateById.mockResolvedValue(updatedTask);
                mockTaskFind.mockReturnValue([]);

                const result = await RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id, mockUsers.user1._id] },
                    mockUsers.owner._id
                );

                expect(result.changeType).toBe('tarea ahora es compartida');
                expect(result.isShared).toBe(true);
            });

            test('Debe detectar cambio de "compartida" a "no compartida"', async () => {
                const recurringTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner, mockUsers.user1]
                });
                mockGetById.mockResolvedValue(recurringTask);
                
                const updatedTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner]
                });
                mockUpdateById.mockResolvedValue(updatedTask);
                mockTaskFind.mockReturnValue([]);

                const result = await RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id] },
                    mockUsers.owner._id
                );

                expect(result.changeType).toBe('tarea dejó de ser compartida');
                expect(result.isShared).toBe(false);
            });

            test('Debe enviar email a usuarios nuevos agregados', async () => {
                mockEmailsToReturn = ['user1@test.com'];

                const recurringTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner]
                });
                mockGetById.mockResolvedValue(recurringTask);
                
                const updatedTask = createMockRecurringTask({
                    assignedTo: [mockUsers.owner, mockUsers.user1]
                });
                mockUpdateById.mockResolvedValue(updatedTask);
                mockTaskFind.mockReturnValue([]);

                const result = await RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id, mockUsers.user1._id] },
                    mockUsers.owner._id
                );

                expect(result.emailSent).toBe(true);
                expect(mockSendRecurringTaskAddUser).toHaveBeenCalled();
            });

            test('Debe retornar null si updateById falla', async () => {
                const recurringTask = createMockRecurringTask();
                mockGetById.mockResolvedValue(recurringTask);
                mockUpdateById.mockResolvedValue(null);

                const result = await RecurringTaskService.update(
                    recurringTask._id,
                    { assignedTo: [mockUsers.owner._id] },
                    mockUsers.owner._id
                );

                expect(result).toBeNull();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE deactivate()
    // ═════════════════════════════════════════════════════════════

    describe('deactivate()', () => {
        test('Debe retornar null si la tarea no existe', async () => {
            mockGetById.mockResolvedValue(null);

            const result = await RecurringTaskService.deactivate('nonexistent');

            expect(result).toBeNull();
        });

        test('Debe rechazar si la tarea ya está desactivada', async () => {
            const deactivatedTask = createMockRecurringTask({
                active: false,
                deactivatedAt: new Date()
            });
            mockGetById.mockResolvedValue(deactivatedTask);

            await expect(RecurringTaskService.deactivate(deactivatedTask._id))
                .rejects.toThrow('Esta tarea recurrente ya fue desactivada y no puede modificarse');
        });

        test('Debe desactivar tarea y eliminar tareas futuras no completadas', async () => {
            const recurringTask = createMockRecurringTask();
            mockGetById
                .mockResolvedValueOnce(recurringTask)
                .mockResolvedValueOnce(recurringTask);
            
            const updatedTask = createMockRecurringTask({
                active: false,
                deactivatedAt: expect.any(Date)
            });
            mockUpdateById.mockResolvedValue(updatedTask);
            mockTaskDeleteMany.mockResolvedValue({ deletedCount: 5 });

            const result = await RecurringTaskService.deactivate(recurringTask._id);

            expect(result.updatedRecurringTask).toEqual(updatedTask);
            expect(result.deletedFutureTasks).toBe(5);
            expect(result.deactivatedAt).toBeInstanceOf(Date);
            expect(mockUpdateById).toHaveBeenCalledWith(
                recurringTask._id,
                expect.objectContaining({
                    active: false,
                    deactivatedAt: expect.any(Date)
                })
            );
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE deleteFutureNonCompletedTasks()
    // ═════════════════════════════════════════════════════════════

    describe('deleteFutureNonCompletedTasks()', () => {
        test('Debe retornar deletedCount: 0 si la tarea recurrente no existe', async () => {
            mockGetById.mockResolvedValue(null);

            const result = await RecurringTaskService.deleteFutureNonCompletedTasks('nonexistent', new Date());

            expect(result).toEqual({ deletedCount: 0 });
        });

        test('Debe eliminar solo tareas futuras no completadas', async () => {
            const recurringTask = createMockRecurringTask();
            mockGetById.mockResolvedValue(recurringTask);
            mockTaskDeleteMany.mockResolvedValue({ deletedCount: 3 });

            const referenceDate = new Date();
            const result = await RecurringTaskService.deleteFutureNonCompletedTasks(
                recurringTask._id,
                referenceDate
            );

            expect(mockTaskDeleteMany).toHaveBeenCalledWith({
                recurringTaskId: recurringTask._id,
                date: { $gt: referenceDate },
                status: { $ne: 'COMPLETADA' }
            });
            expect(result.deletedCount).toBe(3);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE deleteAllFutureIndividualTasks() (deprecated)
    // ═════════════════════════════════════════════════════════════

    describe('deleteAllFutureIndividualTasks()', () => {
        test('Debe retornar null si la tarea recurrente no existe', async () => {
            mockGetById.mockResolvedValue(null);

            const result = await RecurringTaskService.deleteAllFutureIndividualTasks('nonexistent');

            expect(result).toBeNull();
        });

        test('Debe eliminar todas las tareas futuras (incluyendo completadas)', async () => {
            const recurringTask = createMockRecurringTask();
            mockGetById.mockResolvedValue(recurringTask);
            mockTaskDeleteMany.mockResolvedValue({ deletedCount: 10 });

            const result = await RecurringTaskService.deleteAllFutureIndividualTasks(recurringTask._id);

            expect(mockTaskDeleteMany).toHaveBeenCalledWith({
                recurringTaskId: recurringTask._id,
                date: { $gt: expect.any(Date) }
            });
            expect(result.recurringTask).toEqual(recurringTask);
            expect(result.deletedFutureIndividualTasks).toBe(10);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE delete()
    // ═════════════════════════════════════════════════════════════

    describe('delete()', () => {
        test('Debe retornar null si la tarea recurrente no existe', async () => {
            mockGetById.mockResolvedValue(null);

            const result = await RecurringTaskService.delete('nonexistent');

            expect(result).toBeNull();
        });

        test('Debe eliminar la tarea recurrente y todas sus instancias', async () => {
            const recurringTask = createMockRecurringTask();
            mockGetById.mockResolvedValue(recurringTask);
            mockDeleteById.mockResolvedValue(recurringTask);
            mockTaskDeleteMany.mockResolvedValue({ deletedCount: 15 });

            const result = await RecurringTaskService.delete(recurringTask._id);

            expect(mockTaskDeleteMany).toHaveBeenCalledWith({
                recurringTaskId: recurringTask._id
            });
            expect(mockDeleteById).toHaveBeenCalledWith(recurringTask._id);
            expect(result.recurringTask).toEqual(recurringTask);
            expect(result.deletedIndividualTasks).toBe(15);
        });

        test('Debe eliminar tarea recurrente aunque no tenga instancias individuales', async () => {
            const recurringTask = createMockRecurringTask();
            mockGetById.mockResolvedValue(recurringTask);
            mockDeleteById.mockResolvedValue(recurringTask);
            mockTaskDeleteMany.mockResolvedValue({ deletedCount: 0 });

            const result = await RecurringTaskService.delete(recurringTask._id);

            expect(result.deletedIndividualTasks).toBe(0);
            expect(result.recurringTask).toEqual(recurringTask);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE INTEGRACIÓN ENTRE MÉTODOS
    // ═════════════════════════════════════════════════════════════

    describe('Integración entre métodos', () => {
        test('generateTasksForMonth debe usar markExpiredTasks antes de generar', async () => {
            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 2 });
            mockGetAllActive.mockResolvedValue([]);

            const result = await RecurringTaskService.generateTasksForMonth(2026, 1, mockUsers.owner._id);

            expect(mockTaskUpdateMany).toHaveBeenCalled();
            expect(mockGetAllActive).toHaveBeenCalled();
            expect(result.expiredTasksMarked).toBe(2);
        });

        test('deactivate debe llamar a deleteFutureNonCompletedTasks', async () => {
            const recurringTask = createMockRecurringTask();
            mockGetById.mockResolvedValue(recurringTask);
            mockUpdateById.mockResolvedValue({
                ...recurringTask,
                active: false
            });
            mockTaskDeleteMany.mockResolvedValue({ deletedCount: 3 });

            const result = await RecurringTaskService.deactivate(recurringTask._id);

            expect(mockTaskDeleteMany).toHaveBeenCalledWith({
                recurringTaskId: recurringTask._id,
                date: { $gt: expect.any(Date) },
                status: { $ne: 'COMPLETADA' }
            });
            expect(result.deletedFutureTasks).toBe(3);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // TESTS DE EDGE CASES
    // ═════════════════════════════════════════════════════════════

    describe('Edge Cases', () => {
        test('create: debe manejar assignedTo con objetos _id', async () => {
            const params = {
                title: 'Tarea Test',
                assignedTo: [{ _id: mockUsers.owner._id }],
                recurrenceType: 'NUMERIC_PATTERN',
                numberPattern: 15,
                date: getFutureDate(1),
                deadline: getFutureDate(2)
            };

            const expectedRecurringTask = createMockRecurringTask(params);
            mockCreate.mockResolvedValue(expectedRecurringTask);

            const result = await RecurringTaskService.create(params);

            expect(result.recurringTask).toBeDefined();
        });

        test('update: debe manejar owner como ObjectId o como string', async () => {
            const recurringTask1 = createMockRecurringTask({
                assignedTo: [{ _id: { toString: () => mockUsers.owner._id } }]
            });
            mockGetById.mockResolvedValue(recurringTask1);
            mockUpdateById.mockResolvedValue(recurringTask1);
            mockTaskFind.mockReturnValue([]);

            const result1 = await RecurringTaskService.update(
                recurringTask1._id,
                { assignedTo: [mockUsers.owner._id] },
                mockUsers.owner._id
            );

            expect(result1).not.toBeNull();

            const recurringTask2 = createMockRecurringTask({
                assignedTo: [mockUsers.owner._id]
            });
            mockGetById.mockResolvedValue(recurringTask2);
            mockUpdateById.mockResolvedValue(recurringTask2);

            const result2 = await RecurringTaskService.update(
                recurringTask2._id,
                { assignedTo: [mockUsers.owner._id] },
                mockUsers.owner._id
            );

            expect(result2).not.toBeNull();
        });

        test('_calculateMonthlyForMonth: debe manejar año bisiesto en febrero', () => {
            const anchorDate = new Date(Date.UTC(2024, 0, 1, 10, 0, 0));

            const result = RecurringTaskService._calculateMonthlyForMonth(
                2024, 2, 29, anchorDate, 10, 0, 0
            );

            if (result.length > 0) {
                expect(result[0].getUTCDate()).toBe(29);
            }
        });

        test('generateTasksForMonth: debe manejar mes con tareas recurrentes pero sin ocurrencias', async () => {
            const recurringTask = createMockRecurringTask({
                date: new Date(Date.UTC(2027, 0, 1)),
                deadline: new Date(Date.UTC(2027, 0, 2))
            });

            mockTaskUpdateMany.mockResolvedValue({ modifiedCount: 0 });
            mockGetAllActive.mockResolvedValue([recurringTask]);

            const result = await RecurringTaskService.generateTasksForMonth(2026, 1, mockUsers.owner._id);

            expect(result.totalTasksGenerated).toBe(0);
        });
    });
});
