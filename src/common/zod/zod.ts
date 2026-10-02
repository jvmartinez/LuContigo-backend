import { applyDecorators, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { ZodError, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorDominio } from '../errores/error-dominio';

export class ZodPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly esquema: ZodTypeAny) {}

  transform(valor: unknown): unknown {
    try {
      return this.esquema.parse(valor ?? {});
    } catch (e) {
      if (e instanceof ZodError) {
        throw new ErrorDominio('VALIDACION', 'Revisa los datos enviados.', {
          campos: e.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        });
      }
      throw e;
    }
  }
}

/** Cuerpo validado con un esquema de `shared`. */
export const Cuerpo = (esquema: ZodTypeAny) => Body(new ZodPipe(esquema));

/** Query string validada con un esquema de `shared`. */
export const Consulta = (esquema: ZodTypeAny) => Query(new ZodPipe(esquema));

export function aJsonSchema(esquema: ZodTypeAny): Record<string, any> {
  // Tipado laxo a propósito: los genéricos de zod-to-json-schema desbordan a tsc (TS2589).
  const convertir = zodToJsonSchema as (esquema: unknown, opciones: object) => Record<string, any>;
  const { $schema: _, ...resto } = convertir(esquema, { target: 'openApi3', $refStrategy: 'none' });
  return resto;
}

/** Documenta el cuerpo en OpenAPI a partir del esquema Zod, con un ejemplo opcional. */
export function DocCuerpo(esquema: ZodTypeAny, ejemplo?: unknown) {
  return ApiBody({ schema: { ...aJsonSchema(esquema), ...(ejemplo ? { example: ejemplo } : {}) } });
}

/** Documenta cada parámetro de la query en OpenAPI. */
export function DocConsulta(esquema: ZodTypeAny) {
  const json = aJsonSchema(esquema);
  const requeridos = new Set<string>(json.required ?? []);
  return applyDecorators(
    ...Object.entries<Record<string, any>>(json.properties ?? {}).map(([nombre, schema]) =>
      ApiQuery({ name: nombre, required: requeridos.has(nombre), schema }),
    ),
  );
}
