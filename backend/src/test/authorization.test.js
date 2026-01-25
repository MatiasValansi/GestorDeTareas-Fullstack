/**
 * Tests Unitarios para authorization.js (Middleware)
 * 
 * Cobertura:
 * - requireSupervisor: validación de rol supervisor
 * - requireSameSectorForUserParam: validación de mismo sector
 */

// Mock global ANTES de configurar el mock del módulo
const mockGetById = jest.fn();

// Mock de MongoUserRepository ANTES de imports
jest.mock('../repository/user.mongo.repository.js', () => ({
    MongoUserRepository: jest.fn().mockImplementation(() => ({
        getById: mockGetById
    }))
}));

// Usar require después de los mocks
const { requireSupervisor, requireSameSectorForUserParam } = require('../middleware/authorization.js');
const { MongoUserRepository } = require('../repository/user.mongo.repository.js');

describe('authorization.js - Tests Unitarios', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            user: {},
            params: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();
    });

    // ═════════════════════════════════════════════════════════════
    // requireSupervisor()
    // ═════════════════════════════════════════════════════════════

    describe('requireSupervisor()', () => {
        describe('Casos de éxito', () => {
            test('debe llamar next() cuando req.user.isSupervisor es true', () => {
                // Arrange
                mockReq.user = { isSupervisor: true, sector: 'IT' };

                // Act
                requireSupervisor(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
                expect(mockRes.status).not.toHaveBeenCalled();
            });

            test('debe llamar next() con usuario supervisor completo', () => {
                // Arrange
                mockReq.user = {
                    id: '123',
                    email: 'supervisor@test.com',
                    isSupervisor: true,
                    sector: 'HR'
                };

                // Act
                requireSupervisor(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('Casos de error (403)', () => {
            test('debe retornar 403 cuando req.user.isSupervisor es false', () => {
                // Arrange
                mockReq.user = { isSupervisor: false, sector: 'IT' };

                // Act
                requireSupervisor(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Requiere rol de supervisor'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });

            test('debe retornar 403 cuando req.user es undefined', () => {
                // Arrange
                mockReq.user = undefined;

                // Act
                requireSupervisor(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Requiere rol de supervisor'
                });
            });

            test('debe retornar 403 cuando req.user es null', () => {
                // Arrange
                mockReq.user = null;

                // Act
                requireSupervisor(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            test('debe retornar 403 cuando req.user no tiene isSupervisor', () => {
                // Arrange
                mockReq.user = { email: 'test@test.com', sector: 'IT' };

                // Act
                requireSupervisor(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            test('debe retornar 403 cuando isSupervisor es valor falsy (0, "", null)', () => {
                // Test con 0
                mockReq.user = { isSupervisor: 0 };
                requireSupervisor(mockReq, mockRes, mockNext);
                expect(mockRes.status).toHaveBeenCalledWith(403);

                // Reset mocks
                jest.clearAllMocks();

                // Test con ""
                mockReq.user = { isSupervisor: '' };
                requireSupervisor(mockReq, mockRes, mockNext);
                expect(mockRes.status).toHaveBeenCalledWith(403);

                // Reset mocks
                jest.clearAllMocks();

                // Test con null
                mockReq.user = { isSupervisor: null };
                requireSupervisor(mockReq, mockRes, mockNext);
                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // requireSameSectorForUserParam()
    // ═════════════════════════════════════════════════════════════

    describe('requireSameSectorForUserParam()', () => {
        describe('Casos de éxito', () => {
            test('debe llamar next() cuando usuario target tiene mismo sector', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '222' };
                mockGetById.mockResolvedValue({ 
                    _id: '222', 
                    name: 'Target User',
                    sector: 'IT' 
                });

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
                expect(mockRes.status).not.toHaveBeenCalled();
            });

            test('debe funcionar con diferentes sectores pero mismo valor', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'HR' };
                mockReq.params = { id: '222' };
                mockGetById.mockResolvedValue({ 
                    _id: '222', 
                    sector: 'HR' 
                });

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('Casos de error (401)', () => {
            test('debe retornar 401 cuando req.user no tiene sector', async () => {
                // Arrange
                mockReq.user = { id: '111' }; // Sin sector
                mockReq.params = { id: '222' };

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Usuario no autenticado o sin sector'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });

            test('debe retornar 401 cuando req.user es undefined', async () => {
                // Arrange
                mockReq.user = undefined;
                mockReq.params = { id: '222' };

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
            });

            test('debe retornar 401 cuando req.user es null', async () => {
                // Arrange
                mockReq.user = null;
                mockReq.params = { id: '222' };

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
            });

            test('debe retornar 401 cuando sector es string vacío', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: '' };
                mockReq.params = { id: '222' };

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
            });
        });

        describe('Casos de error (404)', () => {
            test('debe retornar 404 cuando usuario target no existe', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '999' };
                mockGetById.mockResolvedValue(null);

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Usuario destino no encontrado'
                });
            });

            test('debe retornar 404 cuando getById retorna undefined', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '999' };
                mockGetById.mockResolvedValue(undefined);

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(404);
            });
        });

        describe('Casos de error (403)', () => {
            test('debe retornar 403 cuando sectores son diferentes', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '222' };
                mockGetById.mockResolvedValue({ 
                    _id: '222', 
                    sector: 'HR' // Diferente sector
                });

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'No tiene permisos para operar sobre usuarios de otro sector'
                });
            });

            test('debe ser case-sensitive en comparación de sectores', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '222' };
                mockGetById.mockResolvedValue({ 
                    _id: '222', 
                    sector: 'it' // Diferente case
                });

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });

        describe('Casos de error (500)', () => {
            test('debe retornar 500 cuando ocurre error en DB', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '222' };
                mockGetById.mockRejectedValue(new Error('Database connection error'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Error interno en validación de sector'
                });
                expect(consoleSpy).toHaveBeenCalled();

                consoleSpy.mockRestore();
            });

            test('debe loggear el error cuando falla la DB', async () => {
                // Arrange
                mockReq.user = { id: '111', sector: 'IT' };
                mockReq.params = { id: '222' };
                const dbError = new Error('Connection timeout');
                mockGetById.mockRejectedValue(dbError);
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                // Act
                await requireSameSectorForUserParam(mockReq, mockRes, mockNext);

                // Assert
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Error en requireSameSectorForUserParam',
                    dbError
                );

                consoleSpy.mockRestore();
            });
        });
    });
});
