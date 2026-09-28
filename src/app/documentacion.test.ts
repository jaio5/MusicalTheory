import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  dailyAiRequests,
  MAX_QUESTION_LENGTH,
  monthlyAiRequests,
  TOKEN_BUDGETS,
} from '@core/billing';
import { BADGES } from '@core/music';

/**
 * Que la documentación no mienta sobre lo que se puede contar.
 *
 * Este repositorio tiene una regla escrita —«una documentación que miente es
 * peor que no tenerla»— y un número escrito a mano es la manera más fácil de
 * romperla sin darse cuenta: `CLAUDE.md` decía «van treinta y cuatro» ADR
 * cuando ya había treinta y seis, y nadie lo nota hasta que alguien va a
 * buscar el que falta.
 *
 * Aquí se vigila lo que tiene un número de verdad al lado con el que comparar.
 * Lo que no se puede contar —si un párrafo sigue siendo cierto— no se vigila
 * desde aquí, se vigila leyéndolo.
 */

const RAIZ = resolve(import.meta.dirname, '../..');

function leer(ruta: string): string {
  return readFileSync(resolve(RAIZ, ruta), 'utf8');
}

/** Los números hasta cuarenta, como los escribe esta casa: con letra. */
const EN_LETRA: Readonly<Record<number, string>> = {
  13: 'trece',
  14: 'catorce',
  15: 'quince',
  16: 'dieciséis',
  17: 'diecisiete',
  18: 'dieciocho',
  30: 'treinta',
  31: 'treinta y uno',
  32: 'treinta y dos',
  33: 'treinta y tres',
  34: 'treinta y cuatro',
  35: 'treinta y cinco',
  36: 'treinta y seis',
  37: 'treinta y siete',
  38: 'treinta y ocho',
  39: 'treinta y nueve',
  40: 'cuarenta',
  41: 'cuarenta y uno',
  42: 'cuarenta y dos',
  43: 'cuarenta y tres',
  44: 'cuarenta y cuatro',
  45: 'cuarenta y cinco',
  46: 'cuarenta y seis',
  47: 'cuarenta y siete',
  48: 'cuarenta y ocho',
  49: 'cuarenta y nueve',
  50: 'cincuenta',
  51: 'cincuenta y uno',
  52: 'cincuenta y dos',
  53: 'cincuenta y tres',
  54: 'cincuenta y cuatro',
  55: 'cincuenta y cinco',
  56: 'cincuenta y seis',
};

describe('lo que la documentación cuenta', () => {
  it('el mapa dice cuántos ADR hay, y son esos', () => {
    const cuantos = readdirSync(resolve(RAIZ, 'docs/adr')).filter((f) => f.endsWith('.md')).length;
    const enLetra = EN_LETRA[cuantos];

    expect(enLetra, `añade ${cuantos} a EN_LETRA`).toBeDefined();
    expect(leer('CLAUDE.md')).toContain(`Van ${enLetra}`);
  });

  /**
   * Y los ADR van numerados sin saltos ni repetidos: un hueco en la serie se
   * lee como un documento borrado, y dos con el mismo número hacen que citar
   * «el ADR 0032» deje de señalar a uno solo.
   */
  it('los ADR van numerados del cero al último, sin huecos', () => {
    const numeros = readdirSync(resolve(RAIZ, 'docs/adr'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => Number(f.slice(0, 4)))
      .sort((a, b) => a - b);

    expect(numeros).toEqual(numeros.map((_, indice) => indice + 1));
  });

  /**
   * **Los cupos que promete la página de los planes son los que da el código.**
   *
   * Ese documento dice de sí mismo que los cupos «no están escritos en ninguna
   * parte: se calculan», y que si no coinciden manda el código. No coincidían:
   * prometía 147, 181 y 271 peticiones al mes con Opus 5 y el código daba 73, 90
   * y 135 —la mitad—, porque las peticiones se encarecieron y la tabla se quedó
   * donde estaba. Es la página del dinero: el número de más no lo paga nadie.
   */
  it('los cupos de la pagina de planes son los que calcula el codigo', () => {
    const texto = leer('docs/CUENTAS-Y-PLANES.md');

    for (const plan of ['basico', 'medio', 'pro'] as const) {
      const mes = monthlyAiRequests(plan, 'claude-opus-5');
      const dia = dailyAiRequests(plan, 'claude-opus-5');
      expect(texto, `el cupo mensual de ${plan}`).toContain(`${mes}/mes · ${dia}/día`);
    }

    // Y la fila de arriba del todo, que es la que se lee antes de pagar.
    const [basico, medio, pro] = (['basico', 'medio', 'pro'] as const).map((plan) =>
      monthlyAiRequests(plan, 'claude-opus-5'),
    );
    expect(texto).toMatch(
      new RegExp(
        `Peticiones a la IA al mes\\s*\\|\\s*15\\s*\\|\\s*${basico}\\s*\\|\\s*${medio}\\s*\\|\\s*${pro}`,
      ),
    );
  });

  /**
   * Y la tabla de despliegue también, que es la que se mira **antes de cambiar
   * `ANTHROPIC_MODEL`**: si miente, alguien baja de modelo creyendo que
   * multiplica los cupos por un número que no es.
   */
  it('la tabla de cupos por modelo del despliegue tambien', () => {
    const texto = leer('docs/DESPLIEGUE.md');

    for (const modelo of ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']) {
      const fila = (['basico', 'medio', 'pro'] as const).map(
        (plan) => `${monthlyAiRequests(plan, modelo)}/mes`,
      );
      for (const celda of fila) {
        expect(texto, `${modelo}: ${celda}`).toContain(celda);
      }
    }
  });

  // La pantalla de medallas dice «de quince», y quince son las que hay.
  it('el catálogo de medallas y lo que dicen los documentos coinciden', () => {
    expect(leer('docs/adr/0028-componer-tambien-cuenta.md')).toContain(
      `${EN_LETRA[BADGES.length] ?? BADGES.length} en total`,
    );
  });

  /**
   * **Los números de `AI.md` son los del presupuesto, y uno no lo era.**
   *
   * Ese documento enseñaba la llamada al modelo con `max_tokens: 2048` cuando el
   * código usa lo que dice `TOKEN_BUDGETS` —400, 700 y 900—. No es un detalle de
   * ejemplo: **ese número es a la vez el tope que impone el servidor y el peor
   * caso con el que se calculan los cupos de los planes**, así que si se separan,
   * lo que se cobra deja de cuadrar con lo que se sirve. Se quedó viejo por lo
   * mismo que la tabla de cupos: nadie lo contaba.
   */
  it('los topes de tokens que ensena AI.md son los del presupuesto', () => {
    const texto = leer('docs/AI.md');

    for (const [feature, budget] of Object.entries(TOKEN_BUDGETS)) {
      expect(texto, `${feature}: ${budget.output}`).toContain(String(budget.output));
    }
    // Y el que estuvo mal no vuelve: no hay ningún tope escrito a mano.
    expect(texto).not.toContain('max_tokens: 2048');
  });

  /**
   * El apartado «Por dónde entra texto que no controlamos» cuenta la superficie
   * con un número. Si el tope de la pregunta cambia y el documento no, ese
   * apartado pasa a decir una cifra que no es la que se aplica — y es el apartado
   * donde menos gracia tiene equivocarse.
   */
  it('la superficie de texto libre que declara AI.md es la que hay', () => {
    expect(leer('docs/AI.md')).toContain(`${MAX_QUESTION_LENGTH} caracteres`);
  });
});
