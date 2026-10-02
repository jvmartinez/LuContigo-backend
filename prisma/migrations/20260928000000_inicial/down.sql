-- Reversión manual de la migración inicial (aplicar después del down.sql de 0100).
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
