// Los tests de integración usan una base SEPARADA (se borra en cada corrida).
// Nunca apuntar TEST_DATABASE_URL a la base de producción.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
