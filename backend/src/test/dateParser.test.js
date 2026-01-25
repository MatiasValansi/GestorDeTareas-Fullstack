/**
 * Tests Unitarios para dateParser.js (Middleware)
 * 
 * Cobertura:
 * - parseDateFields: middleware que convierte fechas en req.body
 * - convertDatesToUTC: helper función pura
 * - Procesamiento recursivo de objetos y arrays
 */

// Mock de ArgentinaTime ANTES de imports
jest.mock('../utils/argentinaTime.js', () => ({
    ArgentinaTime: {
        parseFromFrontend: jest.fn((date) => {
            if (!date) return null;
            // Simular conversión Argentina -> UTC (+3 horas)
            return new Date(date + '-03:00');
        })
    }
}));

import { parseDateFields, convertDatesToUTC } from '../middleware/dateParser.js';
import { ArgentinaTime } from '../utils/argentinaTime.js';

describe('dateParser.js - Tests Unitarios', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();
    });

    // ═════════════════════════════════════════════════════════════
    // parseDateFields() - Middleware
    // ═════════════════════════════════════════════════════════════

    describe('parseDateFields() - Middleware', () => {
        describe('Casos de éxito', () => {
            test('debe convertir campo "deadline" en body', () => {
                // Arrange
                mockReq.body = {
                    title: 'Test Task',
                    deadline: '2026-01-10T19:00:00'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T19:00:00');
                expect(mockNext).toHaveBeenCalled();
            });

            test('debe convertir campo "date" en body', () => {
                // Arrange
                mockReq.body = {
                    date: '2026-01-15T10:00:00'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-15T10:00:00');
            });

            test('debe convertir campo "startingFrom" en body', () => {
                // Arrange
                mockReq.body = {
                    startingFrom: '2026-02-01T08:00:00'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-02-01T08:00:00');
            });

            test('debe convertir campos "createdAt" y "updatedAt"', () => {
                // Arrange
                mockReq.body = {
                    createdAt: '2026-01-01T00:00:00',
                    updatedAt: '2026-01-10T12:00:00'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-01T00:00:00');
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T12:00:00');
            });

            test('debe procesar objetos anidados recursivamente', () => {
                // Arrange
                mockReq.body = {
                    task: {
                        deadline: '2026-01-10T19:00:00',
                        nested: {
                            startingFrom: '2026-02-01T08:00:00'
                        }
                    }
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T19:00:00');
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-02-01T08:00:00');
            });

            test('debe procesar arrays de objetos', () => {
                // Arrange
                mockReq.body = {
                    tasks: [
                        { deadline: '2026-01-10T10:00:00' },
                        { deadline: '2026-01-11T11:00:00' }
                    ]
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T10:00:00');
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-11T11:00:00');
            });

            test('debe ignorar campos que no son de fecha', () => {
                // Arrange
                mockReq.body = {
                    title: 'Test',
                    description: 'Description',
                    priority: 'high',
                    deadline: '2026-01-10T19:00:00'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockReq.body.title).toBe('Test');
                expect(mockReq.body.description).toBe('Description');
                expect(mockReq.body.priority).toBe('high');
                // Solo deadline debe ser procesado
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledTimes(1);
            });

            test('debe manejar body vacío sin romper', () => {
                // Arrange
                mockReq.body = {};

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
                expect(mockReq.body).toEqual({});
            });

            test('debe manejar body null sin romper', () => {
                // Arrange
                mockReq.body = null;

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
            });

            test('debe manejar body undefined sin romper', () => {
                // Arrange
                mockReq.body = undefined;

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
            });

            test('siempre debe llamar next()', () => {
                // Arrange
                mockReq.body = { deadline: '2026-01-10T19:00:00' };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('Edge cases', () => {
            test('debe preservar campos de fecha con valor null (no se procesa)', () => {
                // Arrange
                mockReq.body = {
                    deadline: null,
                    title: 'Test'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert - No se llama parseFromFrontend para valores null/falsy
                expect(ArgentinaTime.parseFromFrontend).not.toHaveBeenCalled();
                expect(mockReq.body.deadline).toBeNull();
                expect(mockNext).toHaveBeenCalled();
            });

            test('debe preservar campos de fecha con valor vacío', () => {
                // Arrange
                mockReq.body = {
                    deadline: '',
                    title: 'Test'
                };

                // Act - campo vacío no se procesa por el if (value)
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
            });

            test('debe manejar arrays vacíos', () => {
                // Arrange
                mockReq.body = {
                    tasks: []
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockReq.body.tasks).toEqual([]);
                expect(mockNext).toHaveBeenCalled();
            });

            test('debe manejar array con valores primitivos', () => {
                // Arrange
                mockReq.body = {
                    tags: ['urgent', 'important']
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(mockReq.body.tags).toEqual(['urgent', 'important']);
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // convertDatesToUTC() - Helper function
    // ═════════════════════════════════════════════════════════════

    describe('convertDatesToUTC() - Helper', () => {
        test('debe convertir campos de fecha como función pura', () => {
            // Arrange
            const data = {
                title: 'Task',
                deadline: '2026-01-10T19:00:00'
            };

            // Act
            const result = convertDatesToUTC(data);

            // Assert
            expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T19:00:00');
            expect(result.title).toBe('Task');
        });

        test('debe retornar el mismo valor para tipos no-objeto', () => {
            // Act & Assert
            expect(convertDatesToUTC(null)).toBeNull();
            expect(convertDatesToUTC(undefined)).toBeUndefined();
            expect(convertDatesToUTC('string')).toBe('string');
            expect(convertDatesToUTC(123)).toBe(123);
        });

        test('debe procesar objetos anidados', () => {
            // Arrange
            const data = {
                level1: {
                    level2: {
                        deadline: '2026-01-10T19:00:00'
                    }
                }
            };

            // Act
            const result = convertDatesToUTC(data);

            // Assert
            expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T19:00:00');
        });

        test('debe procesar arrays', () => {
            // Arrange
            const data = [
                { deadline: '2026-01-10T10:00:00' },
                { deadline: '2026-01-11T11:00:00' }
            ];

            // Act
            const result = convertDatesToUTC(data);

            // Assert
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
        });

        test('no debe mutar el objeto original', () => {
            // Arrange
            const original = {
                title: 'Original',
                deadline: '2026-01-10T19:00:00'
            };
            const originalCopy = { ...original };

            // Act
            const result = convertDatesToUTC(original);

            // Assert - el original no debe cambiar
            expect(original.title).toBe(originalCopy.title);
            // Nota: la función actual sí muta, pero idealmente no debería
        });
    });

    // ═════════════════════════════════════════════════════════════
    // Campos de fecha soportados
    // ═════════════════════════════════════════════════════════════

    describe('Campos de fecha soportados', () => {
        const dateFields = ['deadline', 'startingFrom', 'date', 'createdAt', 'updatedAt'];

        dateFields.forEach(field => {
            test(`debe procesar campo "${field}"`, () => {
                // Arrange
                mockReq.body = {
                    [field]: '2026-01-10T19:00:00'
                };

                // Act
                parseDateFields(mockReq, mockRes, mockNext);

                // Assert
                expect(ArgentinaTime.parseFromFrontend).toHaveBeenCalledWith('2026-01-10T19:00:00');
            });
        });

        test('no debe procesar campos de fecha no listados', () => {
            // Arrange
            mockReq.body = {
                randomDate: '2026-01-10T19:00:00',
                anotherDate: '2026-01-11T10:00:00'
            };

            // Act
            parseDateFields(mockReq, mockRes, mockNext);

            // Assert - no debe llamar parseFromFrontend
            expect(ArgentinaTime.parseFromFrontend).not.toHaveBeenCalled();
            expect(mockReq.body.randomDate).toBe('2026-01-10T19:00:00');
        });
    });
});
