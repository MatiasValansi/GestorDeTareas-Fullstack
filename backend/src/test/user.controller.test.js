/**
 * Tests Unitarios para user.controller.js
 * 
 * Cobertura:
 * - UserController.userAll: listar todos los usuarios
 * - UserController.userValidation: validar existencia de usuario
 * - UserController.userCreateOne: crear nuevo usuario
 * - UserController.userDeleteOne: eliminar usuario
 * - UserController.userUpdateOne: actualizar usuario
 * - UserController.usersBySector: obtener usuarios del mismo sector
 */

// Mocks globales para los métodos del repositorio
const mockGetAll = jest.fn();
const mockGetById = jest.fn();
const mockCreateOne = jest.fn();
const mockDeleteOne = jest.fn();
const mockUpdateOne = jest.fn();
const mockGetBySector = jest.fn();
const mockGetByEmail = jest.fn();
const mockCount = jest.fn();

// Mock de MongoUserRepository ANTES de imports
jest.mock('../repository/user.mongo.repository.js', () => ({
    MongoUserRepository: jest.fn().mockImplementation(() => ({
        getAll: mockGetAll,
        getById: mockGetById,
        createOne: mockCreateOne,
        deleteOne: mockDeleteOne,
        updateOne: mockUpdateOne,
        getBySector: mockGetBySector,
        getByEmail: mockGetByEmail,
        count: mockCount
    }))
}));

jest.mock('../services/user.service.js', () => ({
    UserService: {}
}));

// Usar require después de los mocks para que se apliquen correctamente
const { UserController } = require('../controller/user.controller.js');
const { MongoUserRepository } = require('../repository/user.mongo.repository.js');

describe('UserController - Tests Unitarios', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {},
            params: {},
            user: null
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const mockUsers = [
        { _id: '1', name: 'User 1', email: 'user1@test.com', sector: 'IT' },
        { _id: '2', name: 'User 2', email: 'user2@test.com', sector: 'IT' },
        { _id: '3', name: 'User 3', email: 'user3@test.com', sector: 'HR' }
    ];

    const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        sector: 'IT',
        isSupervisor: false
    };

    const mockCreatedUser = {
        _id: '507f1f77bcf86cd799439022',
        name: 'New User',
        email: 'new@example.com',
        sector: 'IT',
        isSupervisor: false
    };

    // ═════════════════════════════════════════════════════════════
    // UserController.userAll()
    // ═════════════════════════════════════════════════════════════

    describe('UserController.userAll()', () => {
        test('debe retornar 200 con array de usuarios', async () => {
            // Arrange
            mockGetAll.mockResolvedValue(mockUsers);

            // Act
            await UserController.userAll(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Success ---> Los usuarios fueron hallados correctamente',
                payload: mockUsers,
                ok: true
            });
        });

        test('debe retornar 200 con array vacío cuando no hay usuarios', async () => {
            // Arrange
            mockGetAll.mockResolvedValue([]);

            // Act
            await UserController.userAll(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'No hay usuarios registrados',
                payload: [],
                ok: true
            });
        });

        test('debe retornar 500 si hay error de DB', async () => {
            // Arrange
            const dbError = new Error('Database connection failed');
            mockGetAll.mockRejectedValue(dbError);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Act
            await UserController.userAll(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                payload: null,
                message: dbError.message,
                ok: false
            });

            consoleSpy.mockRestore();
        });

        test('debe manejar respuesta null de getAll como error 500', async () => {
            // Arrange
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockGetAll.mockResolvedValue(null);

            // Act
            await UserController.userAll(mockReq, mockRes);

            // Assert - El código actual no maneja null defensivamente, lanza error
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    ok: false,
                    payload: null
                })
            );
            consoleSpy.mockRestore();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // UserController.userValidation()
    // ═════════════════════════════════════════════════════════════

    describe('UserController.userValidation()', () => {
        test('debe retornar 200 con usuario si existe', async () => {
            // Arrange
            mockReq.params = { id: '507f1f77bcf86cd799439011' };
            mockGetById.mockResolvedValue(mockUser);

            // Act
            await UserController.userValidation(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Success --> El usuario fue hallado',
                payload: { userFoundById: mockUser },
                ok: true
            });
        });

        test('debe retornar 404 si usuario no existe', async () => {
            // Arrange
            mockReq.params = { id: 'nonexistent-id' };
            mockGetById.mockResolvedValue(null);

            // Act
            const result = await UserController.userValidation(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                payload: null,
                message: 'El usuario no fue hallado',
                ok: false
            });
            expect(result).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // UserController.userCreateOne()
    // ═════════════════════════════════════════════════════════════

    describe('UserController.userCreateOne()', () => {
        describe('Casos de éxito', () => {
            test('debe retornar 201 cuando supervisor crea usuario', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123'
                    }
                };
                mockGetByEmail.mockResolvedValue(null);
                mockCreateOne.mockResolvedValue(mockCreatedUser);

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(201);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: 'Success --> El usuario ha sido creado',
                        ok: true
                    })
                );
            });

            test('debe retornar 201 en bootstrap (DB vacía, sin auth)', async () => {
                // Arrange
                mockReq.user = null; // Sin autenticación
                mockReq.body = {
                    user: {
                        name: 'First User',
                        email: 'first@example.com',
                        password: 'password123',
                        sector: 'IT'
                    }
                };
                mockCount.mockResolvedValue(0); // DB vacía
                mockGetByEmail.mockResolvedValue(null);
                mockCreateOne.mockResolvedValue(mockCreatedUser);

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(201);
            });

            test('debe usar sector del supervisor creador', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'HR', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123'
                    }
                };
                mockGetByEmail.mockResolvedValue(null);
                mockCreateOne.mockResolvedValue({ ...mockCreatedUser, sector: 'HR' });

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockCreateOne).toHaveBeenCalledWith(
                    expect.objectContaining({ sector: 'HR' })
                );
            });

            test('no debe incluir password en la respuesta', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123'
                    }
                };
                mockGetByEmail.mockResolvedValue(null);
                mockCreateOne.mockResolvedValue({
                    ...mockCreatedUser,
                    password: 'hashedPassword'
                });

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                const responseCall = mockRes.json.mock.calls[0][0];
                expect(responseCall.payload.password).toBeUndefined();
            });
        });

        describe('Casos de error - Validaciones (400)', () => {
            test('debe retornar 400 sin nombre', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        email: 'new@example.com',
                        password: 'password123'
                    }
                };

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    payload: null,
                    message: 'Nombre, email y contraseña son requeridos',
                    ok: false
                });
            });

            test('debe retornar 400 sin email', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        password: 'password123'
                    }
                };

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });

            test('debe retornar 400 sin password', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com'
                    }
                };

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
            });

            test('debe retornar 400 cuando password < 6 caracteres', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: '12345' // Solo 5 caracteres
                    }
                };

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    payload: null,
                    message: 'La contraseña debe tener al menos 6 caracteres',
                    ok: false
                });
            });

            test('debe retornar 400 sin sector (y sin creatorUser)', async () => {
                // Arrange
                mockReq.user = null;
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123'
                        // Sin sector
                    }
                };
                mockCount.mockResolvedValue(0);
                mockGetByEmail.mockResolvedValue(null);

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    payload: null,
                    message: 'El sector es requerido (en bootstrap envíalo como user.sector)',
                    ok: false
                });
            });
        });

        describe('Casos de error (401)', () => {
            test('debe retornar 401 sin auth y DB no vacía', async () => {
                // Arrange
                mockReq.user = null;
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123',
                        sector: 'IT'
                    }
                };
                mockCount.mockResolvedValue(5); // DB no vacía

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    payload: null,
                    message: 'Requiere autenticación para crear usuarios',
                    ok: false
                });
            });
        });

        describe('Casos de error (409)', () => {
            test('debe retornar 409 cuando email ya existe', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'existing@example.com',
                        password: 'password123'
                    }
                };
                mockGetByEmail.mockResolvedValue(mockUser); // Ya existe

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(409);
                expect(mockRes.json).toHaveBeenCalledWith({
                    payload: null,
                    message: 'Ya existe un usuario con ese email',
                    ok: false
                });
            });

            test('debe retornar 409 cuando MongoDB retorna error de duplicado (11000)', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123'
                    }
                };
                mockGetByEmail.mockResolvedValue(null);
                const duplicateError = new Error('Duplicate key');
                duplicateError.code = 11000;
                mockCreateOne.mockRejectedValue(duplicateError);

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(409);
            });
        });

        describe('Casos de error (500)', () => {
            test('debe retornar 500 cuando hay error de DB', async () => {
                // Arrange
                mockReq.user = { id: '123', sector: 'IT', isSupervisor: true };
                mockReq.body = {
                    user: {
                        name: 'New User',
                        email: 'new@example.com',
                        password: 'password123'
                    }
                };
                mockGetByEmail.mockResolvedValue(null);
                mockCreateOne.mockRejectedValue(new Error('DB Error'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                // Act
                await UserController.userCreateOne(mockReq, mockRes);

                // Assert
                expect(mockRes.status).toHaveBeenCalledWith(500);

                consoleSpy.mockRestore();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // UserController.userDeleteOne()
    // ═════════════════════════════════════════════════════════════

    describe('UserController.userDeleteOne()', () => {
        test('debe retornar 200 cuando se elimina usuario', async () => {
            // Arrange
            mockReq.params = { id: '507f1f77bcf86cd799439011' };
            mockDeleteOne.mockResolvedValue(mockUser);

            // Act
            await UserController.userDeleteOne(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: `Success: El usuario "${mockUser.name}" fue eliminado`,
                payload: { userDeleted: mockUser },
                ok: true
            });
        });

        test('debe retornar 404 cuando usuario no existe', async () => {
            // Arrange
            mockReq.params = { id: 'nonexistent-id' };
            mockDeleteOne.mockResolvedValue(null);

            // Act
            await UserController.userDeleteOne(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                payload: null,
                message: 'No se pudo eliminar el usuario con el id: nonexistent-id',
                ok: false
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // UserController.userUpdateOne()
    // ═════════════════════════════════════════════════════════════

    describe('UserController.userUpdateOne()', () => {
        test('debe retornar 200 con datos actualizados', async () => {
            // Arrange
            mockReq.params = { id: '507f1f77bcf86cd799439011' };
            mockReq.body = { name: 'Updated Name', email: 'updated@example.com' };
            const updatedUser = { ...mockUser, name: 'Updated Name', email: 'updated@example.com' };
            mockUpdateOne.mockResolvedValue(updatedUser);

            // Act
            await UserController.userUpdateOne(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Usuario Actualizado',
                payload: updatedUser,
                ok: true
            });
        });

        test('debe retornar 404 cuando usuario no existe', async () => {
            // Arrange
            mockReq.params = { id: 'nonexistent-id' };
            mockReq.body = { name: 'Updated Name' };
            mockUpdateOne.mockResolvedValue(null);

            // Act
            await UserController.userUpdateOne(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                payload: null,
                message: 'No se puede actualizar el usuario con el id: nonexistent-id',
                ok: false
            });
        });

        test('debe pasar correctamente name y email a updateOne', async () => {
            // Arrange
            mockReq.params = { id: '123' };
            mockReq.body = { name: 'New Name', email: 'newemail@test.com' };
            mockUpdateOne.mockResolvedValue(mockUser);

            // Act
            await UserController.userUpdateOne(mockReq, mockRes);

            // Assert
            expect(mockUpdateOne).toHaveBeenCalledWith('123', {
                name: 'New Name',
                email: 'newemail@test.com'
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // UserController.usersBySector()
    // ═════════════════════════════════════════════════════════════

    describe('UserController.usersBySector()', () => {
        test('debe retornar 200 con usuarios del sector', async () => {
            // Arrange
            mockReq.user = { id: '123', sector: 'IT' };
            const itUsers = mockUsers.filter(u => u.sector === 'IT');
            mockGetBySector.mockResolvedValue(itUsers);

            // Act
            await UserController.usersBySector(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Success --> Usuarios del sector encontrados',
                payload: itUsers,
                ok: true
            });
            expect(mockGetBySector).toHaveBeenCalledWith('IT');
        });

        test('debe retornar 400 cuando req.user no tiene sector', async () => {
            // Arrange
            mockReq.user = { id: '123' }; // Sin sector

            // Act
            await UserController.usersBySector(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                payload: null,
                message: 'No se pudo determinar el sector del usuario',
                ok: false
            });
        });

        test('debe retornar 400 cuando req.user es null', async () => {
            // Arrange
            mockReq.user = null;

            // Act
            await UserController.usersBySector(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        test('debe retornar 500 cuando hay error de DB', async () => {
            // Arrange
            mockReq.user = { id: '123', sector: 'IT' };
            mockGetBySector.mockRejectedValue(new Error('DB Error'));

            // Act
            await UserController.usersBySector(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                payload: null,
                message: 'Error al obtener usuarios del sector',
                ok: false
            });
        });

        test('debe retornar array vacío si no hay usuarios en el sector', async () => {
            // Arrange
            mockReq.user = { id: '123', sector: 'EmptySector' };
            mockGetBySector.mockResolvedValue([]);

            // Act
            await UserController.usersBySector(mockReq, mockRes);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Success --> Usuarios del sector encontrados',
                payload: [],
                ok: true
            });
        });
    });
});
