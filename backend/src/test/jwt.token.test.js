/**
 * Tests Unitarios para jwt.token.js
 * 
 * Cobertura:
 * - Generación de tokens JWT válidos
 * - Verificación de payload correcto
 * - Manejo de payloads inválidos
 * - Expiración configurada
 */

// Mock de config ANTES de imports
jest.mock('../config/config.js', () => ({
    config: {
        SECRET_KEY: 'test-secret-key-for-jwt-testing',
        JWT_CONFIG: {
            expiresIn: '1h'
        }
    }
}));

import jwt from 'jsonwebtoken';
import { userToken } from '../utils/jwt.token.js';
import { config } from '../config/config.js';

describe('jwt.token.js - Tests Unitarios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ═════════════════════════════════════════════════════════════
    // DATOS DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    const validPayload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        isSupervisor: true,
        sector: 'IT'
    };

    const minimalPayload = {
        sub: '507f1f77bcf86cd799439022'
    };

    // ═════════════════════════════════════════════════════════════
    // userToken() - Casos de éxito
    // ═════════════════════════════════════════════════════════════

    describe('userToken() - Casos de éxito', () => {
        test('debe generar un token válido con payload completo', () => {
            // Act
            const token = userToken(validPayload);

            // Assert
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT tiene 3 partes
        });

        test('debe incluir las propiedades sub, email, isSupervisor, sector en el token', () => {
            // Act
            const token = userToken(validPayload);
            const decoded = jwt.verify(token, config.SECRET_KEY);

            // Assert
            expect(decoded.sub).toBe(validPayload.sub);
            expect(decoded.email).toBe(validPayload.email);
            expect(decoded.isSupervisor).toBe(validPayload.isSupervisor);
            expect(decoded.sector).toBe(validPayload.sector);
        });

        test('el token debe ser verificable con la misma SECRET_KEY', () => {
            // Act
            const token = userToken(validPayload);

            // Assert - no debe lanzar excepción
            expect(() => jwt.verify(token, config.SECRET_KEY)).not.toThrow();
        });

        test('debe respetar la expiración configurada en JWT_CONFIG', () => {
            // Act
            const token = userToken(validPayload);
            const decoded = jwt.verify(token, config.SECRET_KEY);

            // Assert - debe tener exp (expiración) e iat (issued at)
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
            // La diferencia debe ser aproximadamente 1 hora (3600 segundos)
            expect(decoded.exp - decoded.iat).toBe(3600);
        });

        test('debe generar token con payload mínimo (solo sub)', () => {
            // Act
            const token = userToken(minimalPayload);
            const decoded = jwt.verify(token, config.SECRET_KEY);

            // Assert
            expect(decoded.sub).toBe(minimalPayload.sub);
        });

        test('debe generar tokens únicos para diferentes payloads', () => {
            // Arrange
            const payload1 = { sub: 'user1', email: 'user1@test.com' };
            const payload2 = { sub: 'user2', email: 'user2@test.com' };

            // Act
            const token1 = userToken(payload1);
            const token2 = userToken(payload2);

            // Assert
            expect(token1).not.toBe(token2);
        });

        test('debe generar tokens diferentes en distintos momentos (por iat)', async () => {
            // Arrange
            const payload = { sub: 'user1' };

            // Act
            const token1 = userToken(payload);
            await new Promise(resolve => setTimeout(resolve, 1100)); // Esperar >1 segundo
            const token2 = userToken(payload);

            // Assert
            expect(token1).not.toBe(token2);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // userToken() - Casos de error/edge
    // ═════════════════════════════════════════════════════════════

    describe('userToken() - Casos de error y edge', () => {
        test('debe manejar payload vacío sin lanzar excepción', () => {
            // Act & Assert
            expect(() => userToken({})).not.toThrow();
            const token = userToken({});
            expect(token).toBeDefined();
        });

        test('el token con payload vacío debe ser verificable', () => {
            // Act
            const token = userToken({});
            const decoded = jwt.verify(token, config.SECRET_KEY);

            // Assert
            expect(decoded.iat).toBeDefined();
            expect(decoded.exp).toBeDefined();
        });

        test('debe manejar payload con valores null', () => {
            // Arrange
            const payloadWithNulls = {
                sub: null,
                email: null,
                isSupervisor: null,
                sector: null
            };

            // Act & Assert
            expect(() => userToken(payloadWithNulls)).not.toThrow();
            const token = userToken(payloadWithNulls);
            const decoded = jwt.verify(token, config.SECRET_KEY);
            expect(decoded.sub).toBeNull();
        });

        test('debe manejar payload con valores undefined', () => {
            // Arrange
            const payloadWithUndefined = {
                sub: undefined,
                email: undefined
            };

            // Act & Assert
            expect(() => userToken(payloadWithUndefined)).not.toThrow();
        });

        test('token no debe ser verificable con SECRET_KEY incorrecta', () => {
            // Act
            const token = userToken(validPayload);

            // Assert
            expect(() => jwt.verify(token, 'wrong-secret-key')).toThrow();
        });

        test('debe manejar payload con tipos de datos especiales', () => {
            // Arrange
            const specialPayload = {
                sub: '123',
                numericValue: 42,
                booleanValue: false,
                arrayValue: ['a', 'b'],
                nestedObject: { key: 'value' }
            };

            // Act
            const token = userToken(specialPayload);
            const decoded = jwt.verify(token, config.SECRET_KEY);

            // Assert
            expect(decoded.numericValue).toBe(42);
            expect(decoded.booleanValue).toBe(false);
            expect(decoded.arrayValue).toEqual(['a', 'b']);
            expect(decoded.nestedObject).toEqual({ key: 'value' });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // Integración con jwt library
    // ═════════════════════════════════════════════════════════════

    describe('Integración con jsonwebtoken', () => {
        test('el token debe poder ser decodificado sin verificación', () => {
            // Act
            const token = userToken(validPayload);
            const decoded = jwt.decode(token);

            // Assert
            expect(decoded).toBeDefined();
            expect(decoded.sub).toBe(validPayload.sub);
        });

        test('debe incluir header estándar JWT', () => {
            // Act
            const token = userToken(validPayload);
            const decoded = jwt.decode(token, { complete: true });

            // Assert
            expect(decoded.header.alg).toBe('HS256'); // Algoritmo por defecto
            expect(decoded.header.typ).toBe('JWT');
        });
    });
});
