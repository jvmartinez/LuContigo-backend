import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/** Límite de peticiones por usuario autenticado; por IP en rutas públicas (§10). */
@Injectable()
export class LimiteGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const r = req as Request;
    return r.usuario?.usuarioId ?? r.ip ?? 'desconocido';
  }
}
