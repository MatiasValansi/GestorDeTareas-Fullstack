/**
 * Tests Unitarios para auth.controller.js
 * 
 * Cobertura:
 * - AuthController.login: autenticación de usuarios
 * - AuthController.me: obtener perfil del usuario autenticado
 */

// Mocks globales ANTES de configurar los mocks de módulos
const mockGetByEmailWithPassword = jest.fn();
const mockGetById = jest.fn();
const mockBcryptCompare = jest.fn();
const mockUserToken = jest.fn();

// Mocks de módulos
jest.mock('../repository/user.mongo.repository.js', () => ({
    MongoUserRepository: jest.fn().mockImplementation(() => ({
        getByEmailWithPassword: mockGetByEmailWithPassword,
        getById: mockGetById
    }))
}));

jest.mock('bcrypt', () => ({
    compare: mockBcryptCompare
}));

jest.mock('../utils/jwt.token.js', () => ({
    userToken: mockUserToken
}));

// Usar require después de los mocks
const { AuthController } = require('../controller/auth.controller.js');
const { MongoUserRepository } = require('../repository/user.mongo.repository.js');
const bcrypt = require('bcrypt');
const { userToken } = require('../utils/jwt.token.js');

describe('AuthController - Tests Unitarios', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {},
            user: null,
            authUser: null
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const mockUserWithPassword = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword123',
        sector: 'IT',
        isSupervisor: true
    };

    const mockUserWithoutPassword = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        sector: 'IT',
        isSupervisor: true
    };

    // ═════════════════════════════════════════════════════════════
    // AuthController.login()
    // ═════════════════════════════════════════════════════════════

    describe('AuthController.login()', () => {
        describe('Casos de éxito', () => {
            test('debe retornar 200 con token y user para credenciales válidas', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
                mockBcryptCompare.mockResolvedValue(true);
                userToken.mockReturnValue('mock-jwt-token');

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(200);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        token: 'mock-jwt-token',
                        user: expect.objectContaining({
                            id: mockUserWithPassword._id,
                            email: mockUserWithPassword.email,
                            name: mockUserWithPassword.name,
                            sector: mockUserWithPassword.sector,
                            isSupervisor: mockUserWithPassword.isSupervisor
                        })
                    })
                );
            });

            test('debe generar token con payload correcto', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
                mockBcryptCompare.mockResolvedValue(true);
                userToken.mockReturnValue('mock-jwt-token');

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(userToken).toHaveBeenCalledWith({
                    sub: mockUserWithPassword._id.toString(),
                    email: mockUserWithPassword.email,
                    isSupervisor: mockUserWithPassword.isSupervisor,
                    sector: mockUserWithPassword.sector
                });
            });

            test('no debe incluir password en la respuesta', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
                mockBcryptCompare.mockResolvedValue(true);
                userToken.mockReturnValue('mock-jwt-token');

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                const responseCall = mockRes.json.mock.calls[0][0];
                expect(responseCall.user.password).toBeUndefined();
            });
        });

        describe('Casos de error (400)', () => {
            test('debe retornar 400 sin email', async () => {
                // Arrange
                mockReq.body = { password: 'password123' };

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Email y password son requeridos'
                });
            });

            test('debe retornar 400 sin password', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com' };

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Email y password son requeridos'
                });
            });

            test('debe retornar 400 con body vacío', async () => {
                // Arrange
                mockReq.body = {};

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });

            test('debe retornar 400 con body null', async () => {
                // Arrange
                mockReq.body = null;

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });

            test('debe retornar 400 con body undefined', async () => {
                // Arrange
                mockReq.body = undefined;

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });

            test('debe retornar 400 con email vacío', async () => {
                // Arrange
                mockReq.body = { email: '', password: 'password123' };

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });

            test('debe retornar 400 con password vacío', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: '' };

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });
        });

        describe('Casos de error (401)', () => {
            test('debe retornar 401 cuando email no existe', async () => {
                // Arrange
                mockReq.body = { email: 'nonexistent@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockResolvedValue(null);

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Credenciales inválidas'
                });
            });

            test('debe retornar 401 cuando password es incorrecto', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: 'wrongpassword' };
                mockGetByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
                mockBcryptCompare.mockResolvedValue(false);

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Credenciales inválidas'
                });
            });

            test('debe usar mismo mensaje para email inexistente y password incorrecto (seguridad)', async () => {
                // Test email no existe
                mockReq.body = { email: 'nonexistent@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockResolvedValue(null);
                await AuthController.login(mockReq, mockRes);
                const errorEmailNotFound = mockRes.json.mock.calls[0][0].error;

                // Reset y test password incorrecto
                jest.clearAllMocks();
                mockReq.body = { email: 'test@example.com', password: 'wrongpassword' };
                mockGetByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
                mockBcryptCompare.mockResolvedValue(false);
                await AuthController.login(mockReq, mockRes);
                const errorWrongPassword = mockRes.json.mock.calls[0][0].error;

                // Assert - mismo mensaje para ambos casos
                expect(errorEmailNotFound).toBe(errorWrongPassword);
                expect(errorEmailNotFound).toBe('Credenciales inválidas');
            });
        });

        describe('Casos de error (500)', () => {
            test('debe retornar 500 cuando hay error de DB', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockRejectedValue(new Error('DB Error'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Error interno al intentar iniciar sesión'
                });

                consoleSpy.mockRestore();
            });

            test('debe retornar 500 cuando bcrypt falla', async () => {
                // Arrange
                mockReq.body = { email: 'test@example.com', password: 'password123' };
                mockGetByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
                mockBcryptCompare.mockRejectedValue(new Error('Bcrypt error'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                // Act
                await AuthController.login(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(500);

                consoleSpy.mockRestore();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // AuthController.me()
    // ═════════════════════════════════════════════════════════════

    describe('AuthController.me()', () => {
        describe('Casos de éxito', () => {
            test('debe retornar 200 con user cuando req.authUser está presente', async () => {
                // Arrange
                mockReq.authUser = mockUserWithoutPassword;

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(200);
                expect(mockRes.json).toHaveBeenCalledWith({
                    user: expect.objectContaining({
                        id: mockUserWithoutPassword._id,
                        email: mockUserWithoutPassword.email,
                        name: mockUserWithoutPassword.name
                    })
                });
            });

            test('debe buscar en DB cuando no hay req.authUser pero sí req.user.id', async () => {
                // Arrange
                mockReq.authUser = null;
                mockReq.user = { id: '507f1f77bcf86cd799439011' };
                mockGetById.mockResolvedValue(mockUserWithoutPassword);

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockGetById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
                expect(mockRes.status).toHaveBeenCalledWith(200);
            });

            test('no debe llamar DB cuando req.authUser está presente', async () => {
                // Arrange
                mockReq.authUser = mockUserWithoutPassword;
                mockReq.user = { id: '507f1f77bcf86cd799439011' };

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockGetById).not.toHaveBeenCalled();
            });
        });

        describe('Casos de error (401)', () => {
            test('debe retornar 401 sin req.user', async () => {
                // Arrange
                mockReq.authUser = null;
                mockReq.user = null;

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Usuario no autenticado'
                });
            });

            test('debe retornar 401 sin req.user.id', async () => {
                // Arrange
                mockReq.authUser = null;
                mockReq.user = { email: 'test@example.com' }; // Sin id

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
            });

            test('debe retornar 401 cuando req.user es undefined', async () => {
                // Arrange
                mockReq.authUser = null;
                mockReq.user = undefined;

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
            });
        });

        describe('Casos de error (404)', () => {
            test('debe retornar 404 cuando usuario no se encuentra en DB', async () => {
                // Arrange
                mockReq.authUser = null;
                mockReq.user = { id: 'nonexistent-id' };
                mockGetById.mockResolvedValue(null);

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Usuario no encontrado'
                });
            });
        });

        describe('Casos de error (500)', () => {
            test('debe retornar 500 cuando hay error de DB', async () => {
                // Arrange
                mockReq.authUser = null;
                mockReq.user = { id: '507f1f77bcf86cd799439011' };
                mockGetById.mockRejectedValue(new Error('DB Error'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                // Act
                await AuthController.me(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Error interno al obtener el perfil'
                });

                consoleSpy.mockRestore();
            });
        });
    });
});
