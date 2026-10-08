import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_MODEL,
  dailyAiRequests,
  MAX_QUESTION_LENGTH,
  monthlyAiRequests,
  TOKEN_BUDGETS,
  unidadesDe,
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

/** Los números hasta ciento veinticinco, como los escribe esta casa: con letra. */
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
  57: 'cincuenta y siete',
  58: 'cincuenta y ocho',
  59: 'cincuenta y nueve',
  60: 'sesenta',
  61: 'sesenta y uno',
  62: 'sesenta y dos',
  63: 'sesenta y tres',
  64: 'sesenta y cuatro',
  65: 'sesenta y cinco',
  66: 'sesenta y seis',
  67: 'sesenta y siete',
  68: 'sesenta y ocho',
  69: 'sesenta y nueve',
  70: 'setenta',
  71: 'setenta y una',
  72: 'setenta y dos',
  73: 'setenta y tres',
  74: 'setenta y cuatro',
  75: 'setenta y cinco',
  76: 'setenta y seis',
  77: 'setenta y siete',
  78: 'setenta y ocho',
  79: 'setenta y nueve',
  80: 'ochenta',
  81: 'ochenta y uno',
  82: 'ochenta y dos',
  83: 'ochenta y tres',
  84: 'ochenta y cuatro',
  85: 'ochenta y cinco',
  86: 'ochenta y seis',
  87: 'ochenta y siete',
  88: 'ochenta y ocho',
  89: 'ochenta y nueve',
  90: 'noventa',
  91: 'noventa y uno',
  92: 'noventa y dos',
  93: 'noventa y tres',
  94: 'noventa y cuatro',
  95: 'noventa y cinco',
  96: 'noventa y seis',
  97: 'noventa y siete',
  98: 'noventa y ocho',
  99: 'noventa y nueve',
  100: 'cien',
  101: 'ciento uno',
  102: 'ciento dos',
  103: 'ciento tres',
  104: 'ciento cuatro',
  105: 'ciento cinco',
  106: 'ciento seis',
  107: 'ciento siete',
  108: 'ciento ocho',
  109: 'ciento nueve',
  110: 'ciento diez',
  111: 'ciento once',
  112: 'ciento doce',
  113: 'ciento trece',
  114: 'ciento catorce',
  115: 'ciento quince',
  116: 'ciento dieciséis',
  117: 'ciento diecisiete',
  118: 'ciento dieciocho',
  119: 'ciento diecinueve',
  120: 'ciento veinte',
  121: 'ciento veintiuno',
  122: 'ciento veintidós',
  123: 'ciento veintitrés',
  124: 'ciento veinticuatro',
  125: 'ciento veinticinco',
  126: 'ciento veintiséis',
  127: 'ciento veintisiete',
  128: 'ciento veintiocho',
  129: 'ciento veintinueve',
  130: 'ciento treinta',
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
    // Con el modelo de por defecto, que es el que verá quien entre (adr/0103).
    const modelo = DEFAULT_AI_MODEL;

    for (const plan of ['basico', 'medio'] as const) {
      const mes = monthlyAiRequests(plan, modelo);
      const dia = dailyAiRequests(plan, modelo);
      expect(texto, `el cupo mensual de ${plan}`).toContain(`${mes}/mes · ${dia}/día`);
    }

    // Y la fila de arriba del todo, que es la que se lee antes de pagar.
    const [basico, medio] = (['basico', 'medio'] as const).map((plan) =>
      monthlyAiRequests(plan, modelo),
    );
    expect(texto).toMatch(
      new RegExp(
        `Preguntas al profesor al mes\\s*\\|\\s*15\\s*\\|\\s*${basico}\\s*\\|\\s*${medio}`,
      ),
    );
    // Y lo que gasta una salida, que es la otra mitad del número (adr/0067).
    const k = unidadesDe('salidas', modelo);
    expect(texto).toMatch(
      new RegExp(`Preguntas que gasta una salida\\s*\\|\\s*—\\s*\\|\\s*—\\s*\\|\\s*${k}`),
    );
  });

  /**
   * Y la tabla de despliegue también, que es la que se mira **antes de cambiar
   * `ANTHROPIC_MODEL`**: si miente, alguien cambia de modelo creyendo que
   * multiplica los cupos por un número que no es.
   */
  it('la tabla de cupos por modelo del despliegue tambien', () => {
    const texto = leer('docs/DESPLIEGUE.md');

    // La fila entera de cada modelo, con sus dos planes en su sitio: que «96/mes»
    // salga en cualquier parte del documento no dice de quién es.
    for (const modelo of [
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'claude-opus-5',
      'claude-haiku-4-5',
      'claude-fable-5-1',
    ]) {
      const [basico, medio] = (['basico', 'medio'] as const).map((plan) =>
        monthlyAiRequests(plan, modelo),
      );
      const fila = texto
        .split('\n')
        .find((linea) => linea.startsWith(`| \`${modelo}\``) && linea.includes('/mes'));
      expect(fila, `la fila de ${modelo}`).toBeDefined();
      const celdas = (fila as string).split('|').map((celda) => celda.trim());
      expect(celdas.slice(2, 4), `${modelo}: básico y medio`).toEqual([
        `${basico}/mes`,
        `${medio}/mes`,
      ]);
    }

    // Y la tabla de CUENTAS-Y-PLANES, columna por columna: mes y día por modelo.
    const cuentas = leer('docs/CUENTAS-Y-PLANES.md');
    const modelos = [
      DEFAULT_AI_MODEL,
      'claude-haiku-4-5',
      'claude-opus-5',
      'claude-opus-5-5',
      'claude-fable-5-1',
    ];
    for (const [etiqueta, plan] of [
      ['Básico', 'basico'],
      ['Medio', 'medio'],
    ] as const) {
      const fila = cuentas
        .split('\n')
        .find((l) => l.startsWith(`| ${etiqueta}`) && l.includes('/mes ·'));
      expect(fila, `la fila de ${etiqueta}`).toBeDefined();
      const esperado = modelos.map((modelo, i) => {
        const mes = monthlyAiRequests(plan, modelo);
        const dia = dailyAiRequests(plan, modelo);
        return i === 0 ? `${mes}/mes · ${dia}/día` : `${mes} · ${dia}`;
      });
      const celdas = (fila as string).split('|').map((celda) => celda.trim());
      expect(celdas.slice(2, 7), `${etiqueta} por modelo`).toEqual(esperado);
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

  /**
   * El mapa enruta, no explica: si pasa de unas 130 líneas con contenido, lo que
   * crece es el porqué, y eso vive en `docs/`.
   */
  it('CLAUDE.md no pasa de 130 líneas con contenido', () => {
    const conContenido = leer('CLAUDE.md')
      .split('\n')
      .filter((linea) => linea.trim() !== '');

    expect(conContenido.length).toBeLessThanOrEqual(130);
  });

  /**
   * **Un fichero que un documento nombra existe, y un símbolo de una fila está en
   * el fichero de esa fila.** Los mapas (`CLAUDE.md` y la tabla «busco X») son lo
   * que más se copia y menos se relee: tras partir `versions/` en `salidas/` la
   * tabla siguió mandando a rutas que ya no estaban. Aquí se leen las comillas
   * invertidas y se comprueban contra el árbol de verdad.
   */
  describe('los mapas nombran lo que existe', () => {
    const ficheros = todosLosFicheros();

    for (const doc of ['CLAUDE.md', 'docs/ENCONTRAR-UN-FICHERO.md']) {
      it(`${doc}: cada ruta que nombra existe`, () => {
        const rotas = [...leer(doc).matchAll(/`([^`\n]+)`/g)]
          .map((m) => m[1] as string)
          .filter(pareceUnaRuta)
          .filter((ruta) => resolverRuta(ruta, ficheros).length === 0);

        expect(rotas, 'rutas que no existen en el árbol').toEqual([]);
      });

      it(`${doc}: el símbolo de una fila está en el fichero de esa fila`, () => {
        const sueltos: string[] = [];

        for (const linea of leer(doc).split('\n')) {
          if (!linea.startsWith('|')) continue;
          const fichas = [...linea.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] as string);
          const rutas = fichas.filter(pareceUnaRuta).flatMap((r) => resolverRuta(r, ficheros));
          if (rutas.length === 0) continue;
          const texto = rutas.map((r) => leerSiEsCodigo(r)).join('\n');

          for (const ficha of fichas.filter(pareceUnSimbolo)) {
            if (!texto.includes(ficha)) sueltos.push(`${ficha}  ←  ${linea.slice(0, 60).trim()}`);
          }
        }

        expect(sueltos, 'símbolos que no están en los ficheros de su fila').toEqual([]);
      });
    }
  });

  /**
   * Y los enlaces entre documentos llevan a algún sitio: un `[x](./y.md)` roto
   * se lee bien y falla al pulsarlo, que es cuando ya no hay quien lo arregle.
   */
  it('no hay enlaces relativos rotos en los documentos', () => {
    const documentos = [
      'README.md',
      'CLAUDE.md',
      ...todosLosFicheros().filter((f) => f.startsWith('docs/') && f.endsWith('.md')),
    ];
    const rotos: string[] = [];

    for (const doc of documentos) {
      const sinCodigo = leer(doc).replace(/```[\s\S]*?```/g, '');
      for (const m of sinCodigo.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
        const destino = (m[1] as string).split('#')[0] as string;
        if (destino === '') continue;
        const absoluto = resolve(RAIZ, dirname(doc), destino);
        if (!existsSync(absoluto)) rotos.push(`${doc} → ${m[1]}`);
      }
    }

    expect(rotos).toEqual([]);
  });
});

/** Todos los ficheros del proyecto, con ruta relativa, sin lo generado ni lo instalado. */
function todosLosFicheros(): string[] {
  const fuera = /(^|\/)(node_modules|\.next|\.git|coverage|\.vitest-reports)(\/|$)/;
  return (readdirSync(RAIZ, { recursive: true }) as string[])
    .map((f) => f.split(sep).join('/'))
    .filter((f) => !fuera.test(f));
}

/** ¿Esto, entre comillas invertidas, está diciendo una ruta? */
function pareceUnaRuta(ficha: string): boolean {
  if (/[\s*{}<>:,;=@$]/.test(ficha) || ficha.startsWith('/') || ficha.startsWith('-')) return false;
  // Lo instalado no es del proyecto: lo nombra `CLAUDE.md` para mandar a leerlo.
  if (ficha.startsWith('node_modules/')) return false;
  if (/^\d+$/.test(ficha) || ficha.startsWith('.')) return false;
  const conExtension = /\.(tsx?|mjs|css|md|json|sql|py|svg|ya?ml)$/.test(ficha);
  return (
    conExtension || (ficha.includes('/') && /^[\w\-()[\].]+(\/[\w\-()[\].]+)*\/?$/.test(ficha))
  );
}

/** Un nombre de código con mayúscula dentro (`selectEscala`, `MOVES`), no una palabra. */
function pareceUnSimbolo(ficha: string): boolean {
  return /^[A-Za-z_]\w*$/.test(ficha) && /[A-Z]/.test(ficha.slice(1)) && !ficha.endsWith('.');
}

/** Los ficheros del árbol a los que puede apuntar esa ruta: entera, por el final o como carpeta. */
function resolverRuta(ruta: string, ficheros: readonly string[]): string[] {
  const r = ruta.replace(/\/$/, '');
  return ficheros.filter(
    (f) =>
      f === r ||
      f.endsWith(`/${r}`) ||
      f.startsWith(`${r}/`) ||
      f.includes(`/${r}/`) ||
      f.includes(`/${r}.`) ||
      f.includes(`/${r}-`),
  );
}

function leerSiEsCodigo(ruta: string): string {
  return /\.(tsx?|mjs|css|py|sql|ya?ml|json|md)$/.test(ruta) ? leer(ruta) : '';
}
