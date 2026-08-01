/**
 * Qué modelo hay puesto, en un solo sitio.
 *
 * Lo leían las dos rutas de IA por su cuenta, cada una con su `?? 'claude-opus-5'`.
 * Ahora lo lee esto, porque el modelo dejó de ser un detalle de cada ruta: **de su
 * precio salen los cupos de todos los planes** (`core/billing/cost.ts`). Dos
 * lecturas con dos valores por defecto distintos serían dos aplicaciones cobrando
 * cosas distintas.
 */

import { DEFAULT_AI_MODEL } from '@core/billing';

export function configuredModel(): string {
  const model = process.env['ANTHROPIC_MODEL'];
  return model === undefined || model === '' ? DEFAULT_AI_MODEL : model;
}

/** Si hay clave para hablar con el modelo. Sin ella, las dos rutas callan. */
export function hasModelKey(): boolean {
  const key = process.env['ANTHROPIC_API_KEY'];
  return key !== undefined && key !== '';
}
