-- Reversión manual de 20260928000100_solape_y_auditoria
DROP TRIGGER IF EXISTS auditoria_sin_truncate ON auditoria;
DROP TRIGGER IF EXISTS auditoria_sin_update_delete ON auditoria;
DROP FUNCTION IF EXISTS auditoria_solo_insercion();
ALTER TABLE cita DROP CONSTRAINT IF EXISTS cita_consultorio_sin_solape;
ALTER TABLE cita DROP CONSTRAINT IF EXISTS cita_medico_sin_solape;
ALTER TABLE cita DROP CONSTRAINT IF EXISTS cita_fin_despues_de_inicio;
