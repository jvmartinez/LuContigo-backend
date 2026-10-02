-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('PACIENTE', 'RECEPCION', 'ENFERMERA', 'MEDICO', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'EN_ESPERA', 'LISTA', 'EN_CONSULTA', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "CanalOrigen" AS ENUM ('RECEPCION', 'TELEFONO', 'PORTAL_WEB', 'APP_MOVIL');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANANA', 'TARDE');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'HECHA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CanalRecordatorio" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "EstadoRecordatorio" AS ENUM ('PROGRAMADO', 'ENVIADO', 'FALLIDO', 'CANCELADO', 'OMITIDO');

-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "clinica" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "zona_horaria" TEXT NOT NULL,
    "pais" CHAR(2) NOT NULL,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(3),
    "ultimo_acceso" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_refresco" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_refresco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_restablecimiento" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),

    CONSTRAINT "token_restablecimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidad" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracion_cita_min" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultorio" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "especialidad_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "consultorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "especialidad_id" TEXT,
    "licencia" TEXT,
    "consultorio_id" TEXT,

    CONSTRAINT "personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_atencion" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "personal_id" TEXT NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" CHAR(5) NOT NULL,
    "hora_fin" CHAR(5) NOT NULL,

    CONSTRAINT "horario_atencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ausencia" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "personal_id" TEXT NOT NULL,
    "desde" TIMESTAMPTZ(3) NOT NULL,
    "hasta" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_turno" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "turno" "Turno" NOT NULL,
    "medico_id" TEXT NOT NULL,
    "enfermera_id" TEXT NOT NULL,

    CONSTRAINT "asignacion_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "alergias" TEXT,
    "antecedentes" TEXT,
    "seguro" TEXT,
    "canal_preferido" "CanalRecordatorio",
    "consentimiento_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cita" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "consultorio_id" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA',
    "motivo" TEXT,
    "canal_origen" "CanalOrigen" NOT NULL,
    "motivo_cancelacion" TEXT,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cita_historial_estado" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "cita_id" TEXT NOT NULL,
    "de" "EstadoCita",
    "a" "EstadoCita" NOT NULL,
    "usuario_id" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_historial_estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signos_vitales" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "cita_id" TEXT NOT NULL,
    "enfermera_id" TEXT NOT NULL,
    "presion_sistolica" INTEGER,
    "presion_diastolica" INTEGER,
    "frecuencia_cardiaca" INTEGER,
    "temperatura" DECIMAL(3,1),
    "spo2" INTEGER,
    "peso_kg" DECIMAL(5,2),
    "talla_cm" DECIMAL(5,1),
    "nota" TEXT,
    "alertas" TEXT[],
    "tomado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signos_vitales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consulta" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "cita_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "motivo" TEXT,
    "examen_fisico" TEXT,
    "diagnostico" TEXT,
    "cie10" TEXT,
    "tratamiento" TEXT,
    "indicaciones" TEXT,
    "cerrada_en" TIMESTAMPTZ(3),
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea_delegada" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "enfermera_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completada_en" TIMESTAMPTZ(3),

    CONSTRAINT "tarea_delegada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorio" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "cita_id" TEXT NOT NULL,
    "canal" "CanalRecordatorio",
    "programado_para" TIMESTAMPTZ(3) NOT NULL,
    "enviado_en" TIMESTAMPTZ(3),
    "estado" "EstadoRecordatorio" NOT NULL DEFAULT 'PROGRAMADO',
    "error" TEXT,

    CONSTRAINT "recordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_confirmacion_usado" (
    "jti" TEXT NOT NULL,
    "cita_id" TEXT NOT NULL,
    "usado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_confirmacion_usado_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "dispositivo_push" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dispositivo_push_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "clinica_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "paciente_id" TEXT,
    "ip" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_clinica_id_idx" ON "usuario"("clinica_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_refresco_hash_key" ON "token_refresco"("hash");

-- CreateIndex
CREATE INDEX "token_refresco_usuario_id_idx" ON "token_refresco"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_restablecimiento_hash_key" ON "token_restablecimiento"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "especialidad_clinica_id_nombre_key" ON "especialidad"("clinica_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "consultorio_clinica_id_nombre_key" ON "consultorio"("clinica_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "personal_usuario_id_key" ON "personal"("usuario_id");

-- CreateIndex
CREATE INDEX "personal_clinica_id_idx" ON "personal"("clinica_id");

-- CreateIndex
CREATE INDEX "horario_atencion_clinica_id_personal_id_idx" ON "horario_atencion"("clinica_id", "personal_id");

-- CreateIndex
CREATE INDEX "ausencia_clinica_id_personal_id_desde_idx" ON "ausencia"("clinica_id", "personal_id", "desde");

-- CreateIndex
CREATE INDEX "asignacion_turno_clinica_id_fecha_enfermera_id_idx" ON "asignacion_turno"("clinica_id", "fecha", "enfermera_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_turno_clinica_id_fecha_turno_medico_id_key" ON "asignacion_turno"("clinica_id", "fecha", "turno", "medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_usuario_id_key" ON "paciente"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_clinica_id_documento_key" ON "paciente"("clinica_id", "documento");

-- CreateIndex
CREATE INDEX "cita_clinica_id_medico_id_inicio_idx" ON "cita"("clinica_id", "medico_id", "inicio");

-- CreateIndex
CREATE INDEX "cita_clinica_id_paciente_id_inicio_idx" ON "cita"("clinica_id", "paciente_id", "inicio" DESC);

-- CreateIndex
CREATE INDEX "cita_historial_estado_cita_id_idx" ON "cita_historial_estado"("cita_id");

-- CreateIndex
CREATE UNIQUE INDEX "signos_vitales_cita_id_key" ON "signos_vitales"("cita_id");

-- CreateIndex
CREATE UNIQUE INDEX "consulta_cita_id_key" ON "consulta"("cita_id");

-- CreateIndex
CREATE INDEX "tarea_delegada_clinica_id_enfermera_id_estado_idx" ON "tarea_delegada"("clinica_id", "enfermera_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "recordatorio_cita_id_key" ON "recordatorio"("cita_id");

-- CreateIndex
CREATE INDEX "recordatorio_clinica_id_estado_idx" ON "recordatorio"("clinica_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_push_token_key" ON "dispositivo_push"("token");

-- CreateIndex
CREATE INDEX "dispositivo_push_usuario_id_idx" ON "dispositivo_push"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_clinica_id_paciente_id_fecha_idx" ON "auditoria"("clinica_id", "paciente_id", "fecha" DESC);

-- CreateIndex
CREATE INDEX "auditoria_clinica_id_usuario_id_fecha_idx" ON "auditoria"("clinica_id", "usuario_id", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_refresco" ADD CONSTRAINT "token_refresco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_restablecimiento" ADD CONSTRAINT "token_restablecimiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialidad" ADD CONSTRAINT "especialidad_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultorio" ADD CONSTRAINT "consultorio_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultorio" ADD CONSTRAINT "consultorio_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal" ADD CONSTRAINT "personal_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal" ADD CONSTRAINT "personal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal" ADD CONSTRAINT "personal_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal" ADD CONSTRAINT "personal_consultorio_id_fkey" FOREIGN KEY ("consultorio_id") REFERENCES "consultorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_atencion" ADD CONSTRAINT "horario_atencion_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_turno" ADD CONSTRAINT "asignacion_turno_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_turno" ADD CONSTRAINT "asignacion_turno_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_turno" ADD CONSTRAINT "asignacion_turno_enfermera_id_fkey" FOREIGN KEY ("enfermera_id") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_consultorio_id_fkey" FOREIGN KEY ("consultorio_id") REFERENCES "consultorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita_historial_estado" ADD CONSTRAINT "cita_historial_estado_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signos_vitales" ADD CONSTRAINT "signos_vitales_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signos_vitales" ADD CONSTRAINT "signos_vitales_enfermera_id_fkey" FOREIGN KEY ("enfermera_id") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_delegada" ADD CONSTRAINT "tarea_delegada_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consulta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_delegada" ADD CONSTRAINT "tarea_delegada_enfermera_id_fkey" FOREIGN KEY ("enfermera_id") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorio" ADD CONSTRAINT "recordatorio_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_push" ADD CONSTRAINT "dispositivo_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

