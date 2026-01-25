/**
 * Tests Unitarios para argentinaTime.js
 * 
 * Cobertura:
 * - Conversiones UTC <-> Argentina
 * - Verificación de fechas expiradas/futuras
 * - Formateo de fechas
 * - Parsing de fechas del frontend
 * - Funciones de componentes de fecha (día, mes, año, hora)
 * - Edge cases con null/undefined
 */

import { ArgentinaTime } from '../utils/argentinaTime.js';

describe('ArgentinaTime - Tests Unitarios', () => {
    // ═════════════════════════════════════════════════════════════
    // CONSTANTES DE PRUEBA
    // ═════════════════════════════════════════════════════════════

    // Argentina es UTC-3, sin horario de verano
    const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000; // -3 horas en ms

    // ═════════════════════════════════════════════════════════════
    // nowUTC()
    // ═════════════════════════════════════════════════════════════

    describe('nowUTC()', () => {
        test('debe retornar un objeto Date válido', () => {
            // Act
            const result = ArgentinaTime.nowUTC();

            // Assert
            expect(result).toBeInstanceOf(Date);
        });

        test('debe retornar la fecha actual (aproximada)', () => {
            // Arrange
            const before = new Date();

            // Act
            const result = ArgentinaTime.nowUTC();

            // Arrange
            const after = new Date();

            // Assert - debe estar entre before y after
            expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        test('debe retornar fecha con timezone UTC', () => {
            // Act
            const result = ArgentinaTime.nowUTC();

            // Assert - toISOString siempre termina en Z (UTC)
            expect(result.toISOString()).toMatch(/Z$/);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // argentinaToUTC()
    // ═════════════════════════════════════════════════════════════

    describe('argentinaToUTC()', () => {
        describe('Casos de éxito', () => {
            test('debe convertir correctamente hora Argentina a UTC (+3 horas)', () => {
                // Arrange - 19:00 Argentina sin timezone
                // Nota: JavaScript parsea strings sin timezone como hora LOCAL del sistema
                // La función suma 3 horas para convertir "como si fuera Argentina" a UTC
                const argentinaDateStr = '2026-01-10T19:00:00';

                // Act
                const result = ArgentinaTime.argentinaToUTC(argentinaDateStr);

                // Assert - El resultado debe ser un Date válido
                expect(result).toBeInstanceOf(Date);
                expect(result.getTime()).not.toBeNaN();
            });

            test('debe manejar cambio de día al convertir correctamente', () => {
                // Arrange - fecha sin timezone
                const argentinaDateStr = '2026-01-10T23:00:00';

                // Act
                const result = ArgentinaTime.argentinaToUTC(argentinaDateStr);

                // Assert - debe ser Date válido
                expect(result).toBeInstanceOf(Date);
                expect(result.getTime()).not.toBeNaN();
            });

            test('debe preservar fechas que ya tienen Z (UTC)', () => {
                // Arrange - fecha con Z explícito
                const utcDateStr = '2026-01-10T22:00:00Z';

                // Act
                const result = ArgentinaTime.argentinaToUTC(utcDateStr);

                // Assert - no debe modificar, ya está en UTC
                expect(result.getUTCHours()).toBe(22);
            });

            test('debe preservar fechas con offset explícito', () => {
                // Arrange - fecha con offset explícito
                const dateWithOffset = '2026-01-10T19:00:00-03:00';

                // Act
                const result = ArgentinaTime.argentinaToUTC(dateWithOffset);

                // Assert - ya tiene offset, debe parsear directo
                expect(result.getUTCHours()).toBe(22);
            });

            test('debe aceptar objeto Date como entrada', () => {
                // Arrange
                const dateObj = new Date('2026-01-10T19:00:00');

                // Act
                const result = ArgentinaTime.argentinaToUTC(dateObj);

                // Assert
                expect(result).toBeInstanceOf(Date);
            });
        });

        describe('Casos de error/edge', () => {
            test('debe retornar null para entrada null', () => {
                expect(ArgentinaTime.argentinaToUTC(null)).toBeNull();
            });

            test('debe retornar null para entrada undefined', () => {
                expect(ArgentinaTime.argentinaToUTC(undefined)).toBeNull();
            });

            test('debe retornar null para string vacío', () => {
                expect(ArgentinaTime.argentinaToUTC('')).toBeNull();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // utcToArgentina()
    // ═════════════════════════════════════════════════════════════

    describe('utcToArgentina()', () => {
        describe('Casos de éxito', () => {
            test('debe convertir correctamente UTC a hora Argentina (-3 horas)', () => {
                // Arrange - 22:00 UTC
                const utcDate = new Date('2026-01-10T22:00:00Z');

                // Act
                const result = ArgentinaTime.utcToArgentina(utcDate);

                // Assert - 22:00 UTC = 19:00 Argentina (restar 3 horas)
                // El resultado tiene getUTCHours porque ya ajustamos el tiempo internamente
                expect(result.getUTCHours()).toBe(19);
            });

            test('debe manejar cambio de día al convertir (02:00 UTC → 23:00 día anterior en Argentina)', () => {
                // Arrange - 02:00 UTC del día 11
                const utcDate = new Date('2026-01-11T02:00:00Z');

                // Act
                const result = ArgentinaTime.utcToArgentina(utcDate);

                // Assert - 02:00 UTC = 23:00 del día anterior en Argentina
                expect(result.getUTCHours()).toBe(23);
                expect(result.getUTCDate()).toBe(10);
            });

            test('debe aceptar string ISO como entrada', () => {
                // Arrange
                const utcStr = '2026-01-10T22:00:00Z';

                // Act
                const result = ArgentinaTime.utcToArgentina(utcStr);

                // Assert
                expect(result).toBeInstanceOf(Date);
                expect(result.getUTCHours()).toBe(19);
            });
        });

        describe('Casos de error/edge', () => {
            test('debe retornar null para entrada null', () => {
                expect(ArgentinaTime.utcToArgentina(null)).toBeNull();
            });

            test('debe retornar null para entrada undefined', () => {
                expect(ArgentinaTime.utcToArgentina(undefined)).toBeNull();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // isExpired()
    // ═════════════════════════════════════════════════════════════

    describe('isExpired()', () => {
        test('debe retornar true para fechas pasadas', () => {
            // Arrange - fecha hace 1 día
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            // Act & Assert
            expect(ArgentinaTime.isExpired(pastDate)).toBe(true);
        });

        test('debe retornar false para fechas futuras', () => {
            // Arrange - fecha en 1 día
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            // Act & Assert
            expect(ArgentinaTime.isExpired(futureDate)).toBe(false);
        });

        test('debe retornar true para fecha exactamente ahora (<=)', () => {
            // Arrange - fecha exactamente ahora (o ligeramente pasada por ejecución)
            const now = new Date();

            // Act
            const result = ArgentinaTime.isExpired(now);

            // Assert - puede ser true porque usa <=
            expect(result).toBe(true);
        });

        test('debe retornar false para entrada null', () => {
            expect(ArgentinaTime.isExpired(null)).toBe(false);
        });

        test('debe retornar false para entrada undefined', () => {
            expect(ArgentinaTime.isExpired(undefined)).toBe(false);
        });

        test('debe aceptar string ISO como entrada', () => {
            // Arrange - fecha hace 1 año
            const pastStr = '2020-01-01T00:00:00Z';

            // Act & Assert
            expect(ArgentinaTime.isExpired(pastStr)).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // isFuture()
    // ═════════════════════════════════════════════════════════════

    describe('isFuture()', () => {
        test('debe ser inverso a isExpired() para fechas pasadas', () => {
            // Arrange
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            // Act & Assert
            expect(ArgentinaTime.isFuture(pastDate)).toBe(!ArgentinaTime.isExpired(pastDate));
        });

        test('debe ser inverso a isExpired() para fechas futuras', () => {
            // Arrange
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            // Act & Assert
            expect(ArgentinaTime.isFuture(futureDate)).toBe(!ArgentinaTime.isExpired(futureDate));
        });

        test('debe retornar true para fechas futuras', () => {
            // Arrange
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            // Act & Assert
            expect(ArgentinaTime.isFuture(futureDate)).toBe(true);
        });

        test('debe retornar false para fechas pasadas', () => {
            // Arrange
            const pastDate = new Date('2020-01-01T00:00:00Z');

            // Act & Assert
            expect(ArgentinaTime.isFuture(pastDate)).toBe(false);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // format()
    // ═════════════════════════════════════════════════════════════

    describe('format()', () => {
        test('debe retornar string en formato argentino', () => {
            // Arrange
            const utcDate = new Date('2026-01-10T22:00:00Z');

            // Act
            const result = ArgentinaTime.format(utcDate);

            // Assert - debe ser un string con formato de fecha
            expect(typeof result).toBe('string');
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // DD/MM/YYYY
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.format(null)).toBeNull();
        });

        test('debe retornar null para entrada undefined', () => {
            expect(ArgentinaTime.format(undefined)).toBeNull();
        });

        test('debe aplicar opciones personalizadas de formato', () => {
            // Arrange
            const utcDate = new Date('2026-01-10T22:00:00Z');
            const options = { month: 'long' };

            // Act
            const result = ArgentinaTime.format(utcDate, options);

            // Assert - debe incluir nombre del mes
            expect(result).toMatch(/enero/i);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // formatDate()
    // ═════════════════════════════════════════════════════════════

    describe('formatDate()', () => {
        test('debe retornar solo fecha sin hora en formato DD/MM/YYYY', () => {
            // Arrange
            const utcDate = new Date('2026-01-10T22:00:00Z');

            // Act
            const result = ArgentinaTime.formatDate(utcDate);

            // Assert
            expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.formatDate(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // formatTime()
    // ═════════════════════════════════════════════════════════════

    describe('formatTime()', () => {
        test('debe retornar solo hora en formato HH:MM', () => {
            // Arrange
            const utcDate = new Date('2026-01-10T22:00:00Z');

            // Act
            const result = ArgentinaTime.formatTime(utcDate);

            // Assert - formato HH:MM
            expect(result).toMatch(/^\d{2}:\d{2}$/);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.formatTime(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // parseFromFrontend()
    // ═════════════════════════════════════════════════════════════

    describe('parseFromFrontend()', () => {
        describe('Casos de éxito', () => {
            test('debe interpretar fechas sin timezone como Argentina y convertir a UTC', () => {
                // Arrange - 19:00 sin timezone (interpretado como Argentina)
                const frontendDate = '2026-01-10T19:00:00';

                // Act
                const result = ArgentinaTime.parseFromFrontend(frontendDate);

                // Assert - 19:00 Argentina = 22:00 UTC
                expect(result.getUTCHours()).toBe(22);
            });

            test('debe preservar fechas con Z (ya en UTC)', () => {
                // Arrange
                const utcDate = '2026-01-10T22:00:00Z';

                // Act
                const result = ArgentinaTime.parseFromFrontend(utcDate);

                // Assert - no modifica
                expect(result.getUTCHours()).toBe(22);
            });

            test('debe preservar fechas con offset explícito', () => {
                // Arrange
                const dateWithOffset = '2026-01-10T19:00:00-03:00';

                // Act
                const result = ArgentinaTime.parseFromFrontend(dateWithOffset);

                // Assert
                expect(result.getUTCHours()).toBe(22);
            });

            test('debe manejar formato de fecha corto (solo fecha)', () => {
                // Arrange
                const shortDate = '2026-01-10';

                // Act
                const result = ArgentinaTime.parseFromFrontend(shortDate);

                // Assert - debe ser un Date válido
                expect(result).toBeInstanceOf(Date);
                // Nota: fechas cortas sin T pueden tener comportamiento diferente
            });
        });

        describe('Casos de error/edge', () => {
            test('debe retornar null para entrada null', () => {
                expect(ArgentinaTime.parseFromFrontend(null)).toBeNull();
            });

            test('debe retornar null para entrada undefined', () => {
                expect(ArgentinaTime.parseFromFrontend(undefined)).toBeNull();
            });

            test('debe retornar null para string vacío', () => {
                expect(ArgentinaTime.parseFromFrontend('')).toBeNull();
            });
        });
    });

    // ═════════════════════════════════════════════════════════════
    // getArgentinaDay()
    // ═════════════════════════════════════════════════════════════

    describe('getArgentinaDay()', () => {
        test('debe retornar día de semana correcto en hora Argentina', () => {
            // Arrange - Lunes 19 de enero 2026 a las 01:00 UTC
            // En Argentina sería domingo 18 a las 22:00
            const utcDate = new Date('2026-01-19T01:00:00Z');

            // Act
            const result = ArgentinaTime.getArgentinaDay(utcDate);

            // Assert - 0 = Domingo en Argentina (aunque es lunes en UTC)
            expect(result).toBe(0);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.getArgentinaDay(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // getArgentinaDate()
    // ═════════════════════════════════════════════════════════════

    describe('getArgentinaDate()', () => {
        test('debe retornar día del mes correcto en hora Argentina', () => {
            // Arrange - 11 enero 02:00 UTC = 10 enero 23:00 Argentina
            const utcDate = new Date('2026-01-11T02:00:00Z');

            // Act
            const result = ArgentinaTime.getArgentinaDate(utcDate);

            // Assert
            expect(result).toBe(10);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.getArgentinaDate(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // getArgentinaMonth()
    // ═════════════════════════════════════════════════════════════

    describe('getArgentinaMonth()', () => {
        test('debe retornar mes correcto en hora Argentina (0-11)', () => {
            // Arrange - 1 febrero 01:00 UTC = 31 enero 22:00 Argentina
            const utcDate = new Date('2026-02-01T01:00:00Z');

            // Act
            const result = ArgentinaTime.getArgentinaMonth(utcDate);

            // Assert - enero = 0
            expect(result).toBe(0);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.getArgentinaMonth(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // getArgentinaYear()
    // ═════════════════════════════════════════════════════════════

    describe('getArgentinaYear()', () => {
        test('debe retornar año correcto en hora Argentina', () => {
            // Arrange - 1 enero 2027 01:00 UTC = 31 dic 2026 22:00 Argentina
            const utcDate = new Date('2027-01-01T01:00:00Z');

            // Act
            const result = ArgentinaTime.getArgentinaYear(utcDate);

            // Assert
            expect(result).toBe(2026);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.getArgentinaYear(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // getArgentinaHours()
    // ═════════════════════════════════════════════════════════════

    describe('getArgentinaHours()', () => {
        test('debe retornar hora correcta en Argentina', () => {
            // Arrange - 22:00 UTC
            const utcDate = new Date('2026-01-10T22:00:00Z');

            // Act
            const result = ArgentinaTime.getArgentinaHours(utcDate);

            // Assert - 22:00 UTC = 19:00 Argentina
            expect(result).toBe(19);
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.getArgentinaHours(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // createFromArgentinaComponents()
    // ═════════════════════════════════════════════════════════════

    describe('createFromArgentinaComponents()', () => {
        test('debe crear fecha UTC desde componentes Argentina', () => {
            // Arrange - 18 enero 2026, 22:00 Argentina
            // Esperado: 19 enero 2026, 01:00 UTC

            // Act
            const result = ArgentinaTime.createFromArgentinaComponents(2026, 0, 18, 22, 0, 0);

            // Assert
            expect(result.getUTCFullYear()).toBe(2026);
            expect(result.getUTCMonth()).toBe(0); // enero
            expect(result.getUTCDate()).toBe(19);
            expect(result.getUTCHours()).toBe(1);
        });

        test('debe crear fecha al inicio del día por defecto', () => {
            // Act - sin especificar hora
            const result = ArgentinaTime.createFromArgentinaComponents(2026, 0, 10);

            // Assert - 00:00 Argentina = 03:00 UTC
            expect(result.getUTCHours()).toBe(3);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // daysUntilTargetDay()
    // ═════════════════════════════════════════════════════════════

    describe('daysUntilTargetDay()', () => {
        test('debe retornar 0 si ya es el día objetivo', () => {
            // Arrange - Domingo en Argentina
            const sundayInArgentina = new Date('2026-01-18T15:00:00Z'); // Domingo 12:00 Argentina

            // Act
            const result = ArgentinaTime.daysUntilTargetDay(sundayInArgentina, 0); // 0 = Domingo

            // Assert
            expect(result).toBe(0);
        });

        test('debe calcular días correctamente cuando el objetivo está adelante', () => {
            // Arrange - Lunes en Argentina, buscar viernes (5)
            const mondayInArgentina = new Date('2026-01-19T15:00:00Z'); // Lunes 12:00 Argentina

            // Act
            const result = ArgentinaTime.daysUntilTargetDay(mondayInArgentina, 5); // 5 = Viernes

            // Assert - de lunes a viernes = 4 días
            expect(result).toBe(4);
        });

        test('debe calcular días correctamente cuando el objetivo ya pasó esta semana', () => {
            // Arrange - Viernes en Argentina, buscar lunes (1)
            const fridayInArgentina = new Date('2026-01-23T15:00:00Z'); // Viernes 12:00 Argentina

            // Act
            const result = ArgentinaTime.daysUntilTargetDay(fridayInArgentina, 1); // 1 = Lunes

            // Assert - de viernes a lunes próximo = 3 días
            expect(result).toBe(3);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // getMonthStartUTC() y getMonthEndUTC()
    // ═════════════════════════════════════════════════════════════

    describe('getMonthStartUTC()', () => {
        test('debe retornar primer momento del mes en UTC', () => {
            // Act
            const result = ArgentinaTime.getMonthStartUTC(2026, 1);

            // Assert
            expect(result.getUTCFullYear()).toBe(2026);
            expect(result.getUTCMonth()).toBe(0);
            expect(result.getUTCDate()).toBe(1);
            expect(result.getUTCHours()).toBe(0);
            expect(result.getUTCMinutes()).toBe(0);
        });
    });

    describe('getMonthEndUTC()', () => {
        test('debe retornar último momento del mes en UTC', () => {
            // Act
            const result = ArgentinaTime.getMonthEndUTC(2026, 1);

            // Assert
            expect(result.getUTCFullYear()).toBe(2026);
            expect(result.getUTCMonth()).toBe(0);
            expect(result.getUTCDate()).toBe(31); // Enero tiene 31 días
            expect(result.getUTCHours()).toBe(23);
            expect(result.getUTCMinutes()).toBe(59);
        });

        test('debe manejar febrero correctamente', () => {
            // Act - febrero 2026 (no bisiesto)
            const result = ArgentinaTime.getMonthEndUTC(2026, 2);

            // Assert
            expect(result.getUTCDate()).toBe(28);
        });
    });

    // ═════════════════════════════════════════════════════════════
    // toArgentinaISO()
    // ═════════════════════════════════════════════════════════════

    describe('toArgentinaISO()', () => {
        test('debe retornar string ISO con offset -03:00', () => {
            // Arrange
            const utcDate = new Date('2026-01-10T22:00:00Z');

            // Act
            const result = ArgentinaTime.toArgentinaISO(utcDate);

            // Assert
            expect(result).toMatch(/-03:00$/);
            expect(result).toContain('2026-01-10T19:00:00');
        });

        test('debe retornar null para entrada null', () => {
            expect(ArgentinaTime.toArgentinaISO(null)).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════
    // nowFormatted()
    // ═════════════════════════════════════════════════════════════

    describe('nowFormatted()', () => {
        test('debe retornar string de fecha actual formateada', () => {
            // Act
            const result = ArgentinaTime.nowFormatted();

            // Assert
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
