import { Module } from '@nestjs/common';
import { ClinicasController } from './clinicas.controller';

/** Datos de la clínica, especialidades y consultorios (RF-17). */
@Module({ controllers: [ClinicasController] })
export class ClinicasModule {}
