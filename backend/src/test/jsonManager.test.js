/**
 * Tests Unitarios para JsonManager.js
 * 
 * Cobertura:
 * - Lectura de archivos JSON
 * - Escritura de archivos JSON
 * - Manejo de errores (archivo inexistente, JSON malformado)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { JsonHandler } from '../utils/JsonManager.js';

// Timeout extendido para operaciones de filesystem en Windows
jest.setTimeout(15000);

describe('JsonHandler - Tests Unitarios', () => {
    // ═════════════════════════════════════════════════════════════
    // CONFIGURACIÓN DE TESTS
    // ═════════════════════════════════════════════════════════════

    const TEST_DIR = path.join(process.cwd(), 'src', 'test', 'temp');
    const TEST_FILE_PATH = path.join(TEST_DIR, 'test-data.json');
    const NONEXISTENT_PATH = path.join(TEST_DIR, 'nonexistent', 'file.json');

    // Crear directorio temporal antes de los tests
    beforeAll(async () => {
        try {
            await fs.mkdir(TEST_DIR, { recursive: true });
        } catch (error) {
            // Ignorar si ya existe
        }
    });

    // Limpiar archivos después de cada test
    afterEach(async () => {
        try {
            await fs.unlink(TEST_FILE_PATH);
        } catch (error) {
            // Ignorar si no existe
        }
    });

    // Limpiar directorio después de todos los tests
    afterAll(async () => {
        try {
            await fs.rm(TEST_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignorar errores
        }
    });

    // ═════════════════════════════════════════════════════════════
    // read() - Casos de éxito
    // ═════════════════════════════════════════════════════════════

    describe('read() - Casos de éxito', () => {
        test('debe leer y parsear JSON válido', async () => {
            // Arrange
            const testData = { name: 'Test', value: 123 };
            await fs.writeFile(TEST_FILE_PATH, JSON.stringify(testData), 'utf8');

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(result).toEqual(testData);
        });

        test('debe leer array JSON correctamente', async () => {
            // Arrange
            const testArray = [{ id: 1 }, { id: 2 }, { id: 3 }];
            await fs.writeFile(TEST_FILE_PATH, JSON.stringify(testArray), 'utf8');

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(result).toEqual(testArray);
            expect(Array.isArray(result)).toBe(true);
        });

        test('debe leer JSON con caracteres especiales', async () => {
            // Arrange
            const testData = { 
                message: 'Hola, ¿cómo estás? 🚀',
                special: 'áéíóúñ'
            };
            await fs.writeFile(TEST_FILE_PATH, JSON.stringify(testData), 'utf8');

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(result.message).toBe('Hola, ¿cómo estás? 🚀');
            expect(result.special).toBe('áéíóúñ');
        });

        test('debe leer JSON con estructura anidada', async () => {
            // Arrange
            const nestedData = {
                level1: {
                    level2: {
                        level3: { value: 'deep' }
                    }
                }
            };
            await fs.writeFile(TEST_FILE_PATH, JSON.stringify(nestedData), 'utf8');

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(result.level1.level2.level3.value).toBe('deep');
        });

        test('debe leer JSON con tipos de datos variados', async () => {
            // Arrange
            const mixedData = {
                string: 'texto',
                number: 42,
                boolean: true,
                nullValue: null,
                array: [1, 2, 3],
                object: { key: 'value' }
            };
            await fs.writeFile(TEST_FILE_PATH, JSON.stringify(mixedData), 'utf8');

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(result.string).toBe('texto');
            expect(result.number).toBe(42);
            expect(result.boolean).toBe(true);
            expect(result.nullValue).toBeNull();
            expect(result.array).toEqual([1, 2, 3]);
            expect(result.object).toEqual({ key: 'value' });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // read() - Casos de error
    // ═════════════════════════════════════════════════════════════

    describe('read() - Casos de error', () => {
        test('debe manejar archivo inexistente sin lanzar excepción', async () => {
            // Arrange
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Act
            const result = await JsonHandler.read('/path/to/nonexistent/file.json');

            // Assert - no debe lanzar, pero puede retornar undefined
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('debe manejar JSON malformado sin lanzar excepción', async () => {
            // Arrange
            await fs.writeFile(TEST_FILE_PATH, '{ invalid json }', 'utf8');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('debe manejar archivo vacío', async () => {
            // Arrange
            await fs.writeFile(TEST_FILE_PATH, '', 'utf8');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Act
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert - archivo vacío puede retornar array vacío por || []
            consoleSpy.mockRestore();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // write() - Casos de éxito
    // ═════════════════════════════════════════════════════════════

    describe('write() - Casos de éxito', () => {
        test('debe escribir JSON formateado correctamente', async () => {
            // Arrange
            const testData = { name: 'Test', value: 123 };

            // Act
            await JsonHandler.write(testData, TEST_FILE_PATH);

            // Assert
            const fileContent = await fs.readFile(TEST_FILE_PATH, 'utf8');
            const parsed = JSON.parse(fileContent);
            expect(parsed).toEqual(testData);
        });

        test('debe escribir JSON con indentación (2 espacios)', async () => {
            // Arrange
            const testData = { key: 'value' };

            // Act
            await JsonHandler.write(testData, TEST_FILE_PATH);

            // Assert
            const fileContent = await fs.readFile(TEST_FILE_PATH, 'utf8');
            // JSON.stringify(data, null, 2) agrega nueva línea y 2 espacios
            expect(fileContent).toContain('\n');
            expect(fileContent).toContain('  ');
        });

        test('debe escribir array JSON correctamente', async () => {
            // Arrange
            const testArray = [1, 2, 3, 4, 5];

            // Act
            await JsonHandler.write(testArray, TEST_FILE_PATH);

            // Assert
            const result = await JsonHandler.read(TEST_FILE_PATH);
            expect(result).toEqual(testArray);
        });

        test('debe sobrescribir archivo existente', async () => {
            // Arrange
            const originalData = { original: true };
            const newData = { new: true };
            await JsonHandler.write(originalData, TEST_FILE_PATH);

            // Act
            await JsonHandler.write(newData, TEST_FILE_PATH);

            // Assert
            const result = await JsonHandler.read(TEST_FILE_PATH);
            expect(result).toEqual(newData);
            expect(result.original).toBeUndefined();
        });

        test('debe manejar objetos con valores null', async () => {
            // Arrange
            const dataWithNull = { key: null, other: 'value' };

            // Act
            await JsonHandler.write(dataWithNull, TEST_FILE_PATH);

            // Assert
            const result = await JsonHandler.read(TEST_FILE_PATH);
            expect(result.key).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // write() - Casos de error
    // ═════════════════════════════════════════════════════════════

    describe('write() - Casos de error', () => {
        test('debe manejar path inválido sin lanzar excepción', async () => {
            // Arrange
            const testData = { key: 'value' };
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            // Act - path con directorio que no existe
            await JsonHandler.write(testData, NONEXISTENT_PATH);

            // Assert - debe loggear error
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('debe manejar datos con referencias circulares', async () => {
            // Arrange
            const circularData = { key: 'value' };
            circularData.self = circularData; // Referencia circular
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            // Act & Assert - JSON.stringify falla con refs circulares
            await JsonHandler.write(circularData, TEST_FILE_PATH);

            // Assert
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // Integración read/write
    // ═════════════════════════════════════════════════════════════

    describe('Integración read/write', () => {
        test('debe poder leer lo que se escribe', async () => {
            // Arrange
            const testData = {
                users: [
                    { id: 1, name: 'Juan' },
                    { id: 2, name: 'María' }
                ],
                meta: { version: '1.0.0' }
            };

            // Act
            await JsonHandler.write(testData, TEST_FILE_PATH);
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert
            expect(result).toEqual(testData);
        });

        test('debe mantener integridad de datos después de múltiples escrituras', async () => {
            // Arrange
            const data1 = { step: 1 };
            const data2 = { step: 2 };
            const data3 = { step: 3 };

            // Act
            await JsonHandler.write(data1, TEST_FILE_PATH);
            await JsonHandler.write(data2, TEST_FILE_PATH);
            await JsonHandler.write(data3, TEST_FILE_PATH);
            const result = await JsonHandler.read(TEST_FILE_PATH);

            // Assert - solo debe quedar el último
            expect(result).toEqual(data3);
        });
    });
});
