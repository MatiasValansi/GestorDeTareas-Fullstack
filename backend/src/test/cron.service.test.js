/**
 * Tests Unitarios para cron.service.js
 * 
 * Cobertura:
 * - runDailyTaskReminders(): envío de recordatorios de tareas
 * - Agrupación de tareas por email
 * - Manejo de casos edge (sin tareas, sin email, etc.)
 */

// Mocks ANTES de imports
jest.mock('../model/Task.js', () => ({
    TaskModel: {
        find: jest.fn()
    }
}));

jest.mock('../services/email.service.js', () => ({
    sendTaskReminderEmail: jest.fn()
}));

jest.mock('../utils/argentinaTime.js', () => ({
    ArgentinaTime: {
        getArgentinaYear: jest.fn(),
        getArgentinaMonth: jest.fn(),
        getArgentinaDate: jest.fn(),
        createFromArgentinaComponents: jest.fn(),
        format: jest.fn()
    }
}));

const { runDailyTaskReminders } = require('../services/cron.service.js');
const { TaskModel } = require('../model/Task.js');
const { sendTaskReminderEmail } = require('../services/email.service.js');
const { ArgentinaTime } = require('../utils/argentinaTime.js');

describe('cron.service.js - Tests Unitarios', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup por defecto de ArgentinaTime
        ArgentinaTime.getArgentinaYear.mockReturnValue(2026);
        ArgentinaTime.getArgentinaMonth.mockReturnValue(0); // Enero
        ArgentinaTime.getArgentinaDate.mockReturnValue(25);
        ArgentinaTime.createFromArgentinaComponents.mockImplementation(
            (year, month, day, hour, min, sec) => new Date(Date.UTC(year, month, day, hour + 3, min, sec))
        );
        ArgentinaTime.format.mockReturnValue('25/01/2026, 10:00');
    });

    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const createMockTask = (id, title, assignedTo) => ({
        _id: id,
        title,
        status: 'PENDIENTE',
        deadline: new Date('2026-01-25T22:00:00Z'),
        assignedTo: assignedTo
    });

    const mockUser1 = { _id: 'user1', email: 'user1@test.com', name: 'User 1' };
    const mockUser2 = { _id: 'user2', email: 'user2@test.com', name: 'User 2' };
    const mockUserNoEmail = { _id: 'user3', name: 'User Sin Email' };

    // ═════════════════════════════════════════════════════════════
    // runDailyTaskReminders() - Casos de éxito
    // ═════════════════════════════════════════════════════════════

    describe('runDailyTaskReminders() - Casos de éxito', () => {
        test('debe encontrar tareas con deadline hoy y enviar mails', async () => {
            // Arrange
            const tasks = [
                createMockTask('task1', 'Tarea 1', [mockUser1]),
                createMockTask('task2', 'Tarea 2', [mockUser2])
            ];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });
            sendTaskReminderEmail.mockResolvedValue(true);

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.tasksFound).toBe(2);
            expect(result.usersNotified).toBe(2);
            expect(result.mailsSent).toBe(2);
            expect(sendTaskReminderEmail).toHaveBeenCalledTimes(2);
        });

        test('debe agrupar múltiples tareas del mismo usuario en 1 mail', async () => {
            // Arrange - 2 tareas para el mismo usuario
            const tasks = [
                createMockTask('task1', 'Tarea 1', [mockUser1]),
                createMockTask('task2', 'Tarea 2', [mockUser1])
            ];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });
            sendTaskReminderEmail.mockResolvedValue(true);

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.tasksFound).toBe(2);
            expect(result.usersNotified).toBe(1);
            expect(result.mailsSent).toBe(1);
            expect(sendTaskReminderEmail).toHaveBeenCalledTimes(1);
            expect(sendTaskReminderEmail).toHaveBeenCalledWith({
                to: 'user1@test.com',
                tasks: expect.arrayContaining([
                    expect.objectContaining({ title: 'Tarea 1' }),
                    expect.objectContaining({ title: 'Tarea 2' })
                ])
            });
        });

        test('debe retornar objeto con dateArgentina, tasksFound, usersNotified, mailsSent', async () => {
            // Arrange
            const tasks = [createMockTask('task1', 'Tarea 1', [mockUser1])];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });
            sendTaskReminderEmail.mockResolvedValue(true);

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result).toHaveProperty('dateArgentina');
            expect(result).toHaveProperty('tasksFound');
            expect(result).toHaveProperty('usersNotified');
            expect(result).toHaveProperty('mailsSent');
        });

        test('debe usar rango de fechas correcto (hoy 00:00 a 23:59 en Argentina)', async () => {
            // Arrange
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });

            // Act
            await runDailyTaskReminders();

            // Assert
            expect(ArgentinaTime.createFromArgentinaComponents).toHaveBeenCalledWith(
                2026, 0, 25, 0, 0, 0
            );
            expect(ArgentinaTime.createFromArgentinaComponents).toHaveBeenCalledWith(
                2026, 0, 25, 23, 59, 59
            );
        });

        test('debe buscar solo tareas PENDIENTE', async () => {
            // Arrange
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });

            // Act
            await runDailyTaskReminders();

            // Assert
            expect(TaskModel.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'PENDIENTE'
                })
            );
        });
    });

    // ═════════════════════════════════════════════════════════════
    // runDailyTaskReminders() - Casos edge
    // ═════════════════════════════════════════════════════════════

    describe('runDailyTaskReminders() - Casos edge', () => {
        test('debe retornar mailsSent=0 cuando no hay tareas pendientes hoy', async () => {
            // Arrange
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.tasksFound).toBe(0);
            expect(result.usersNotified).toBe(0);
            expect(result.mailsSent).toBe(0);
            expect(sendTaskReminderEmail).not.toHaveBeenCalled();
        });

        test('debe saltar usuarios sin email', async () => {
            // Arrange
            const tasks = [
                createMockTask('task1', 'Tarea 1', [mockUserNoEmail]),
                createMockTask('task2', 'Tarea 2', [mockUser1])
            ];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });
            sendTaskReminderEmail.mockResolvedValue(true);

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.tasksFound).toBe(2);
            expect(result.mailsSent).toBe(1); // Solo 1 mail (user1)
            expect(sendTaskReminderEmail).toHaveBeenCalledWith({
                to: 'user1@test.com',
                tasks: expect.any(Array)
            });
        });

        test('debe manejar tarea sin assignedTo sin romper', async () => {
            // Arrange
            const taskWithoutAssigned = {
                _id: 'task1',
                title: 'Tarea Sin Asignar',
                status: 'PENDIENTE',
                deadline: new Date(),
                assignedTo: null
            };
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([taskWithoutAssigned])
            });

            // Act
            const result = await runDailyTaskReminders();

            // Assert - no debe lanzar error
            expect(result.tasksFound).toBe(1);
            expect(result.mailsSent).toBe(0);
        });

        test('debe manejar assignedTo como array vacío', async () => {
            // Arrange
            const taskWithEmptyAssigned = {
                _id: 'task1',
                title: 'Tarea Sin Asignados',
                status: 'PENDIENTE',
                deadline: new Date(),
                assignedTo: []
            };
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([taskWithEmptyAssigned])
            });

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.tasksFound).toBe(1);
            expect(result.mailsSent).toBe(0);
        });

        test('debe manejar tarea con múltiples assignedTo', async () => {
            // Arrange - Una tarea asignada a 2 usuarios
            const taskMultipleAssigned = createMockTask('task1', 'Tarea Compartida', [mockUser1, mockUser2]);
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([taskMultipleAssigned])
            });
            sendTaskReminderEmail.mockResolvedValue(true);

            // Act
            const result = await runDailyTaskReminders();

            // Assert - 1 tarea pero 2 usuarios = 2 mails
            expect(result.tasksFound).toBe(1);
            expect(result.usersNotified).toBe(2);
            expect(result.mailsSent).toBe(2);
        });

        test('debe manejar usuario con email null', async () => {
            // Arrange
            const userWithNullEmail = { _id: 'user1', email: null, name: 'User' };
            const tasks = [createMockTask('task1', 'Tarea', [userWithNullEmail])];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.mailsSent).toBe(0);
            expect(sendTaskReminderEmail).not.toHaveBeenCalled();
        });

        test('debe manejar usuario con email undefined', async () => {
            // Arrange
            const userWithUndefinedEmail = { _id: 'user1', name: 'User' }; // Sin email
            const tasks = [createMockTask('task1', 'Tarea', [userWithUndefinedEmail])];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.mailsSent).toBe(0);
        });

        test('debe manejar usuario null en array de assignedTo', async () => {
            // Arrange
            const tasks = [createMockTask('task1', 'Tarea', [null, mockUser1])];
            
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue(tasks)
            });
            sendTaskReminderEmail.mockResolvedValue(true);

            // Act
            const result = await runDailyTaskReminders();

            // Assert - Solo cuenta a mockUser1
            expect(result.mailsSent).toBe(1);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // Populate y filtros
    // ═════════════════════════════════════════════════════════════

    describe('Populate y filtros', () => {
        test('debe usar populate para obtener email y name de assignedTo', async () => {
            // Arrange
            const populateMock = jest.fn().mockResolvedValue([]);
            TaskModel.find.mockReturnValue({
                populate: populateMock
            });

            // Act
            await runDailyTaskReminders();

            // Assert
            expect(populateMock).toHaveBeenCalledWith('assignedTo', 'email name');
        });

        test('debe filtrar por rango de deadline', async () => {
            // Arrange
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });

            // Act
            await runDailyTaskReminders();

            // Assert
            expect(TaskModel.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    deadline: expect.objectContaining({
                        $gte: expect.any(Date),
                        $lte: expect.any(Date)
                    })
                })
            );
        });
    });

    // ═════════════════════════════════════════════════════════════
    // Formato de respuesta
    // ═════════════════════════════════════════════════════════════

    describe('Formato de respuesta', () => {
        test('debe incluir dateArgentina formateada', async () => {
            // Arrange
            TaskModel.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });
            ArgentinaTime.format.mockReturnValue('25/01/2026, 14:30');

            // Act
            const result = await runDailyTaskReminders();

            // Assert
            expect(result.dateArgentina).toBe('25/01/2026, 14:30');
            expect(ArgentinaTime.format).toHaveBeenCalled();
        });
    });
});
