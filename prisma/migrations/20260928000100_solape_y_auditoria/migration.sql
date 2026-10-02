-- Migración manual (Prisma no genera estas restricciones). Reversión en down.sql.

-- RF-05: un médico o un consultorio no pueden tener dos citas activas que se solapen,
-- aunque dos personas agenden al mismo tiempo. El servicio traduce 23P01 a 409 HORARIO_OCUPADO.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE cita ADD CONSTRAINT cita_fin_despues_de_inicio CHECK (fin > inicio);

ALTER TABLE cita ADD CONSTRAINT cita_medico_sin_solape
  EXCLUDE USING gist (
    medico_id WITH =,
    tstzrange(inicio, fin) WITH &&
  ) WHERE (estado NOT IN ('CANCELADA', 'NO_ASISTIO'));

ALTER TABLE cita ADD CONSTRAINT cita_consultorio_sin_solape
  EXCLUDE USING gist (
    consultorio_id WITH =,
    tstzrange(inicio, fin) WITH &&
  ) WHERE (estado NOT IN ('CANCELADA', 'NO_ASISTIO'));

-- RF-20: la bitácora solo admite inserciones, sea cual sea el rol de la conexión.
-- En producción, además: REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM <usuario_app>;
CREATE OR REPLACE FUNCTION auditoria_solo_insercion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla auditoria solo admite inserciones';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_sin_update_delete
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion();

CREATE TRIGGER auditoria_sin_truncate
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_solo_insercion();
