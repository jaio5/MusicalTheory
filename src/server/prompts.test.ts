import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  MAX_IDEAS,
  MAX_QUESTION_LENGTH,
  MAX_RECENT_CHORDS,
  MAX_RECENT_NOTES,
  MAX_VERSION_DEGREES,
  MAX_VERSIONS,
  TOKEN_BUDGETS,
} from '@core/billing';
import { MOVES } from '@core/music';

import {
  ANSWER_SCHEMA,
  ideasSchema,
  IDEAS_SYSTEM_PROMPT,
  type IdeasKind,
  TEACHER_SYSTEM_PROMPT,
  versionsSchema,
  VERSIONS_SYSTEM_PROMPT,
} from './prompts';

/**
 * El guardián del modelo de coste.
 *
 * Los cupos de todos los planes se calculan dividiendo el presupuesto del plan
 * entre el peor caso de una petición, y ese peor caso incluye una **estimación**
 * de los tokens de entrada: el prompt de sistema, los datos de la tonalidad y el
 * esquema de salida. La estimación está en `core/billing/cost.ts`.
 *
 * El día que alguien alargue un prompt de sistema, esa estimación se queda corta y
 * los cupos empiezan a prometer más de lo que hay dinero para pagar, en silencio y
 * sin que nada falle. Este test es lo que hace ruido: mide los prompts de verdad y
 * comprueba que siguen cabiendo.
 *
 * No cuenta tokens de verdad —para eso hace falta llamar a `count_tokens`, y eso
 * pide clave y red—: cuenta caracteres y divide. Es una aproximación, y por eso el
 * presupuesto lleva holgura de sobra; lo que este test detecta no es un carácter de
 * más, es un prompt que ha doblado de tamaño.
 */

/**
 * Caracteres por token en español, a la baja.
 *
 * El tokenizador saca entre 3,5 y 4 caracteres por token en texto español normal.
 * Se usa 3,2 —menos caracteres por token, o sea más tokens— porque equivocarse a
 * favor del gasto es lo que no puede pasar aquí.
 */
const CHARS_PER_TOKEN = 3.2;

function estimatedTokens(...texts: readonly string[]): number {
  const chars = texts.reduce((total, text) => total + text.length, 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/** El esquema de salida también viaja como entrada, y también se paga. */
function schemaText(schema: unknown): string {
  return JSON.stringify(schema);
}

/**
 * El esquema de ideas más largo de los que se pueden mandar.
 *
 * Desde que depende de lo que se pida hay seis —tres clases por dos modos—, y el
 * presupuesto lo tiene que aguantar el peor, no el que salga primero. Se calcula
 * en vez de escribirse: si mañana entra una escala más en el enumerado, este
 * número sube solo y el test avisa antes que la factura.
 */
const CLASES_DE_IDEA: readonly IdeasKind[] = ['progression', 'twist', 'scale'];

const IDEAS_SCHEMA_MAS_LARGO = CLASES_DE_IDEA.flatMap((kind) =>
  (['major', 'minor'] as const).map((mode) => schemaText(ideasSchema(kind, mode))),
).reduce((largo, texto) => (texto.length > largo.length ? texto : largo));

/**
 * El esquema de salidas más largo, por lo mismo: hay cuatro —dos modos por dos
 * clases de salida— y el presupuesto lo tiene que aguantar el peor.
 */
const VERSIONS_SCHEMA_MAS_LARGO = (['major', 'minor'] as const)
  .flatMap((mode) =>
    (['continuar', 'retocar'] as const).map((kind) => schemaText(versionsSchema(mode, kind))),
  )
  .reduce((largo, texto) => (texto.length > largo.length ? texto : largo));

describe('el presupuesto de tokens del profesor', () => {
  it('el prompt de sistema, el esquema y la pregunta más larga caben', () => {
    // Lo que la ruta manda como mucho: sistema + esquema + los datos de la
    // tonalidad (unos 300 caracteres entre grados, escala y tema) + la pregunta.
    const datos = 'x'.repeat(300 + MAX_QUESTION_LENGTH);
    const estimado = estimatedTokens(TEACHER_SYSTEM_PROMPT, schemaText(ANSWER_SCHEMA), datos);

    expect(estimado).toBeLessThanOrEqual(TOKEN_BUDGETS.profesor.input);
  });

  // Si esto falla, no es que el test esté mal: es que el prompt ha crecido tanto
  // que el modelo de coste está mintiendo y hay que recalcular los cupos.
  it('queda holgura, para que un retoque del prompt no descuadre los cupos', () => {
    const estimado = estimatedTokens(TEACHER_SYSTEM_PROMPT, schemaText(ANSWER_SCHEMA));

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.profesor.input * 0.7);
  });
});

describe('el presupuesto de tokens de las ideas', () => {
  it('el prompt de sistema, el esquema y el contexto más largo caben', () => {
    // Lo peor: notas y acordes recientes hasta su tope, más los grados válidos.
    const notas = 'Ab '.repeat(MAX_RECENT_NOTES);
    const acordes = 'Cmaj7 '.repeat(MAX_RECENT_CHORDS);
    const grados = 'bVII, '.repeat(20);
    const estimado = estimatedTokens(
      IDEAS_SYSTEM_PROMPT,
      IDEAS_SCHEMA_MAS_LARGO,
      notas,
      acordes,
      grados,
    );

    expect(estimado).toBeLessThanOrEqual(TOKEN_BUDGETS.ideas.input);
  });

  it('queda holgura', () => {
    const estimado = estimatedTokens(IDEAS_SYSTEM_PROMPT, IDEAS_SCHEMA_MAS_LARGO);

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.ideas.input * 0.7);
  });
});

describe('los topes de salida', () => {
  /**
   * El tope de salida no es una estimación: es el `max_tokens` que la ruta impone,
   * así que el peor caso del modelo de coste es exacto por construcción. Lo único
   * que hay que comprobar es que sigue habiendo sitio para lo que se promete.
   */
  it('el profesor tiene sitio para una respuesta de tres frases con ejemplo', () => {
    // Tres frases largas en español son unas 90 palabras; con el JSON y el ejemplo
    // en grados, unos 200 tokens. El tope deja margen para el doble.
    expect(TOKEN_BUDGETS.profesor.output).toBeGreaterThanOrEqual(400);
  });

  it('las ideas tienen sitio para las cuatro que como mucho se piden', () => {
    // Cada idea son un título corto, una frase y unos grados: unos 60 tokens.
    expect(TOKEN_BUDGETS.ideas.output).toBeGreaterThanOrEqual(MAX_IDEAS * 60);
  });

  // Una idea cuesta más que una pregunta, y el reparto de topes tiene que
  // reflejarlo o el cupo del plan con ideas saldría mal.
  it('una tanda de ideas puede ser más larga que una respuesta del profesor', () => {
    expect(TOKEN_BUDGETS.ideas.output).toBeGreaterThan(TOKEN_BUDGETS.profesor.output);
  });
});

describe('el presupuesto de tokens de las versiones', () => {
  it('el prompt, el esquema, la progresión más larga y el catálogo caben', () => {
    // Lo peor: la progresión entera hasta su tope con sus pulsos, más los cinco
    // movimientos con su nombre y su porqué, más los grados válidos.
    const progresion = 'bVII x4, '.repeat(MAX_VERSION_DEGREES);
    const movimientos = MOVES.map((move) => `${move.id}: ${move.why}`).join('\n');
    const grados = 'bVII, '.repeat(20);
    const estimado = estimatedTokens(
      VERSIONS_SYSTEM_PROMPT,
      VERSIONS_SCHEMA_MAS_LARGO,
      progresion,
      movimientos,
      grados,
    );

    expect(estimado).toBeLessThanOrEqual(TOKEN_BUDGETS.versiones.input);
  });

  it('queda holgura', () => {
    const estimado = estimatedTokens(VERSIONS_SYSTEM_PROMPT, VERSIONS_SCHEMA_MAS_LARGO);

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.versiones.input * 0.7);
  });

  it('hay sitio de salida para tres progresiones enteras y sus porqués', () => {
    // Cada versión son treinta y dos compases con su grado y su movimiento, más
    // un título y una frase: unos 280 tokens en el peor caso.
    expect(TOKEN_BUDGETS.versiones.output).toBeGreaterThanOrEqual(MAX_VERSIONS * 280);
  });

  it('una tanda de versiones es lo más caro que se puede pedir', () => {
    // Si dejara de serlo, `worstFeature` estaría calculando el cupo del plan Pro
    // con la petición equivocada y el margen saldría mal.
    for (const feature of ['profesor', 'ideas'] as const) {
      const versiones = TOKEN_BUDGETS.versiones;
      const otra = TOKEN_BUDGETS[feature];
      expect(versiones.input + versiones.output).toBeGreaterThan(otra.input + otra.output);
    }
  });
});

describe('la puerta del modelo', () => {
  /**
   * `hasModelKey` estuvo escrita y sin llamar desde la fase 5, y su ausencia
   * costaba dinero de verdad: `spendAi` gasta la petición **antes** de hablar con
   * el modelo, así que sin proveedor configurado alguien se quedaba sin
   * peticiones del mes por una variable de entorno que faltaba.
   *
   * Esto lo vigilaba leyendo las tres rutas y comparando en qué línea aparecía
   * cada llamada. Funcionaba, pero era un test de texto sobre tres ficheros, y
   * bastaba mover una línea al refactorizar para perderlo. **Ahora la garantía es
   * estructural**: las rutas no gastan cupo por su cuenta, y quien lo gasta
   * comprueba el proveedor primero porque es la misma función.
   *
   * Quedan dos comprobaciones, y las dos son de una línea de código cada una:
   * que ninguna ruta se salte la puerta, y que dentro de la puerta el orden sea
   * el que es.
   */
  it('ninguna ruta gasta cupo por su cuenta', () => {
    for (const ruta of ['ideas', 'teacher', 'versiones']) {
      const codigo = readFileSync(
        fileURLToPath(new URL(`../app/api/${ruta}/route.ts`, import.meta.url)),
        'utf8',
      );

      expect(codigo, `${ruta} llama a spendAi sin pasar por la puerta`).not.toContain('spendAi');
      expect(codigo, `${ruta} no pasa por la puerta`).toContain('abrirPuertaDeIa');
    }
  });

  it('la puerta mira el proveedor antes de gastar', () => {
    const codigo = readFileSync(fileURLToPath(new URL('./ai-gate.ts', import.meta.url)), 'utf8');
    const proveedor = codigo.indexOf('modelAvailable()');
    const cupo = codigo.indexOf('await spendAi(');

    expect(proveedor).toBeGreaterThan(-1);
    expect(cupo).toBeGreaterThan(-1);
    expect(proveedor, 'la puerta gasta cupo antes de mirar si hay quien conteste').toBeLessThan(
      cupo,
    );
  });
});
