import { applyDecorators, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ZodError, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CODIGOS_ERROR, CodigoError, ErrorSalida } from '../../shared/errores';
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

/** Documenta una respuesta exitosa en OpenAPI; sin esquema, la respuesta no tiene cuerpo. */
export function DocRespuesta(
  status: number,
  descripcion: string,
  esquema?: ZodTypeAny,
  ejemplo?: unknown,
) {
  return ApiResponse({
    status,
    description: descripcion,
    ...(esquema && {
      schema: { ...aJsonSchema(esquema), ...(ejemplo ? { example: ejemplo } : {}) },
    }),
  });
}

/** Documenta los errores posibles con el formato `{ error: { codigo, mensaje, detalles } }`. */
export function DocErrores(...codigos: CodigoError[]) {
  const porStatus = new Map<number, CodigoError[]>();
  for (const codigo of codigos) {
    const status = CODIGOS_ERROR[codigo];
    porStatus.set(status, [...(porStatus.get(status) ?? []), codigo]);
  }
  const schema = aJsonSchema(ErrorSalida);
  return applyDecorators(
    ...[...porStatus].map(([status, lista]) =>
      ApiResponse({ status, description: `Error: ${lista.join(', ')}`, schema }),
    ),
  );
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
