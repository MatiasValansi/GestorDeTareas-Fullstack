/**
 * Tests Unitarios para auth.jwt.js (Middleware)
 * 
 * Cobertura:
 * - Validación de token JWT
 * - Adjuntar req.user con payload normalizado
 * - Adjuntar req.authUser con documento de BD
 * - Manejo de errores de autenticación
 */

import jwt from 'jsonwebtoken';

// Mock global para el método getById que será compartido
const mockGetById = jest.fn();

// Mock de dependencias ANTES de importar el módulo bajo test
jest.mock('../config/config.js', () => ({
    config: {
        SECRET_KEY: 'test-secret-key-for-auth-testing'
    }
}));

jest.mock('../repository/user.mongo.repository.js', () => ({
    MongoUserRepository: jest.fn().mockImplementation(() => ({
        getById: mockGetById
    }))
}));

// Importar DESPUÉS de configurar los mocks
const { authByToken } = require('../middleware/auth.jwt.js');
const { config } = require('../config/config.js');

describe('auth.jwt.js - Tests Unitarios', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    // ═════════════════════════════════════════════════════════════
    // CONFIGURACIÓN
    // ═════════════════════════════════════════════════════════════

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            headers: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();
    });

    // Helper para generar token válido
    const generateValidToken = (payload) => {
        return jwt.sign(payload, config.SECRET_KEY, { expiresIn: '1h' });
    };

    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const validPayload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        isSupervisor: true,
        sector: 'IT'
    };

    const mockDbUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        sector: 'IT',
        isSupervisor: true
    };

    // ═════════════════════════════════════════════════════════════
    // authByToken() - Casos de éxito
    // ═════════════════════════════════════════════════════════════

    describe('authByToken() - Casos de éxito', () => {
        test('debe llamar next() con token válido', async () => {
            // Arrange
            const token = generateValidToken(validPayload);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('debe adjuntar req.user con {id, email, isSupervisor, sector}', async () => {
            // Arrange
            const token = generateValidToken(validPayload);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.id).toBe(validPayload.sub);
            expect(mockReq.user.email).toBe(validPayload.email);
            expect(mockReq.user.isSupervisor).toBe(validPayload.isSupervisor);
            expect(mockReq.user.sector).toBe(validPayload.sector);
        });

        test('debe adjuntar req.authUser con documento completo de BD', async () => {
            // Arrange
            const token = generateValidToken(validPayload);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockReq.authUser).toBeDefined();
            expect(mockReq.authUser).toEqual(mockDbUser);
        });

        test('debe aceptar payload con "sub" como identificador', async () => {
            // Arrange
            const payloadWithSub = { sub: 'user-id-123', email: 'test@test.com' };
            const token = generateValidToken(payloadWithSub);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockReq.user.id).toBe('user-id-123');
        });

        test('debe aceptar payload con "id" como identificador', async () => {
            // Arrange
            const payloadWithId = { id: 'user-id-456', email: 'test@test.com' };
            const token = generateValidToken(payloadWithId);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockReq.user.id).toBe('user-id-456');
        });

        test('debe aceptar payload con "_id" como identificador', async () => {
            // Arrange
            const payloadWith_Id = { _id: 'user-id-789', email: 'test@test.com' };
            const token = generateValidToken(payloadWith_Id);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockReq.user.id).toBe('user-id-789');
        });

        test('debe priorizar "sub" sobre "id" y "_id"', async () => {
            // Arrange
            const payloadWithAll = { 
                sub: 'sub-id', 
                id: 'id-value', 
                _id: '_id-value',
                email: 'test@test.com' 
            };
            const token = generateValidToken(payloadWithAll);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockReq.user.id).toBe('sub-id');
        });
    });

    // ═════════════════════════════════════════════════════════════
    // authByToken() - Casos de error (401)
    // ═════════════════════════════════════════════════════════════

    describe('authByToken() - Casos de error (401)', () => {
        test('debe retornar 401 sin header Authorization', async () => {
            // Arrange - no headers.authorization

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token no proporcionado o con formato inválido'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('debe retornar 401 con header sin "Bearer "', async () => {
            // Arrange
            mockReq.headers.authorization = 'InvalidFormat token123';

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token no proporcionado o con formato inválido'
            });
        });

        test('debe retornar 401 con header vacío', async () => {
            // Arrange
            mockReq.headers.authorization = '';

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        test('debe retornar 401 con token expirado', async () => {
            // Arrange - token que expira inmediatamente
            const expiredToken = jwt.sign(
                validPayload, 
                config.SECRET_KEY, 
                { expiresIn: '-1s' } // Ya expirado
            );
            mockReq.headers.authorization = `Bearer ${expiredToken}`;

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token inválido o expirado'
            });
        });

        test('debe retornar 401 con firma inválida', async () => {
            // Arrange - token firmado con otra clave
            const invalidToken = jwt.sign(validPayload, 'wrong-secret-key');
            mockReq.headers.authorization = `Bearer ${invalidToken}`;

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token inválido o expirado'
            });
        });

        test('debe retornar 401 con token malformado', async () => {
            // Arrange
            mockReq.headers.authorization = 'Bearer invalid.token.format';

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token inválido o expirado'
            });
        });

        test('debe retornar 401 cuando usuario no existe en DB', async () => {
            // Arrange
            const token = generateValidToken(validPayload);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockResolvedValue(null); // Usuario no existe

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Usuario autenticado no encontrado'
            });
        });

        test('debe retornar 401 con "Bearer" sin token', async () => {
            // Arrange
            mockReq.headers.authorization = 'Bearer ';

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // Edge cases
    // ═════════════════════════════════════════════════════════════

    describe('Edge cases', () => {
        test('debe manejar header con espacios extra', async () => {
            // Arrange
            const token = generateValidToken(validPayload);
            mockReq.headers.authorization = `Bearer  ${token}`; // Doble espacio
            mockGetById.mockResolvedValue(mockDbUser);

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert - el split(" ")[1] tomará string vacío
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        test('debe manejar caso donde getById lanza excepción', async () => {
            // Arrange
            const token = generateValidToken(validPayload);
            mockReq.headers.authorization = `Bearer ${token}`;
            mockGetById.mockRejectedValue(new Error('DB Error'));

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert - debe caer en catch y retornar 401
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        test('debe manejar payload sin userId (sub/id/_id)', async () => {
            // Arrange
            const payloadNoId = { email: 'test@test.com', isSupervisor: false };
            const token = generateValidToken(payloadNoId);
            mockReq.headers.authorization = `Bearer ${token}`;
            // getById no se llama porque userId es undefined

            // Act
            await authByToken(mockReq, mockRes, mockNext);

            // Assert - debe pasar pero sin buscar en DB
            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user.id).toBeUndefined();
        });
    });
});
