import { can, type PlanId } from '@core/billing';

import { ETIQUETAS } from './PlanCards';

/**
 * Lo que trae un plan y lo que no, **dicho con las palabras de las tarjetas**.
 *
 * Existe porque cuatro pantallas lo contaban escrito a mano y se contradecían:
 * una decía que lo único que pedía cuenta era la IA, otra que sin pagar se tenía
 * todo menos la IA y el Grado Profesional, y las dos callaban que el repaso y
 * guardar las canciones van con el plan Básico. La tabla de permisos
 * (`core/billing/plans.ts`) ya lo sabía; lo que faltaba era preguntarle a ella
 * en vez de recordarlo.
 *
 * Las palabras son las de `ETIQUETAS`, las mismas filas que se leen en las
 * tarjetas de los planes: si una pantalla dice «el repaso de lo que fallaste» y la
 * tarjeta de al lado otra cosa, parecen dos prestaciones distintas.
 */

/** Lo que `plan` trae y `desde` no, en el orden de las tarjetas. */
export function loQueSuma(plan: PlanId, desde: PlanId = 'gratis'): string[] {
  return ETIQUETAS.filter(({ capability }) => can(plan, capability) && !can(desde, capability)).map(
    ({ label }) => label,
  );
}

/** Lo que trae `plan`, todo. */
export function loQueTrae(plan: PlanId): string[] {
  return ETIQUETAS.filter(({ capability }) => can(plan, capability)).map(({ label }) => label);
}

/** Lo que `plan` no trae: para el gratis, todo lo que va con pagar. */
export function loQueNoTrae(plan: PlanId): string[] {
  return ETIQUETAS.filter(({ capability }) => !can(plan, capability)).map(({ label }) => label);
}

/**
 * Una lista dentro de una frase: «a, b y c».
 *
 * Las etiquetas empiezan en mayúscula porque en las tarjetas encabezan su fila;
 * dentro de una frase, la primera letra baja. Solo la primera: «Grado
 * Profesional» sigue siendo un nombre propio a media etiqueta.
 */
export function enUnaFrase(cosas: readonly string[]): string {
  const minusculas = cosas.map((cosa) => cosa.charAt(0).toLocaleLowerCase('es') + cosa.slice(1));
  if (minusculas.length < 2) {
    return minusculas.join('');
  }
  return `${minusculas.slice(0, -1).join(', ')} y ${minusculas.at(-1)}`;
}
