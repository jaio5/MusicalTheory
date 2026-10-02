import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  MAX_QUESTION_LENGTH,
  MAX_VERSION_DEGREES,
  MAX_VERSIONS,
  TOKEN_BUDGETS,
} from '@core/billing';
import {
  COURSES,
  degreesFor,
  GLOSSARY,
  keyChordTable,
  MOVES,
  SHARP_NAMES,
  SCALE_IDS,
  theoryReference,
  type KeyMode,
  type PitchClass,
} from '@core/music';

import {
  ANSWER_SCHEMA,
  CABECERA_DE_TEORIA,
  cabeceraDePrompt,
  lineaDeEscala,
  lineaDeTema,
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
 * El esquema de salidas más largo de los que se pueden mandar: hay cuatro —dos modos por dos
 * clases de salida— y el presupuesto lo tiene que aguantar el peor, no el que
 * salga primero. Se calcula en vez de escribirse: si mañana entra un grado más en
 * el enumerado, este número sube solo y el test avisa antes que la factura.
 */
const VERSIONS_SCHEMA_MAS_LARGO = (['major', 'minor'] as const)
  .flatMap((mode) =>
    (['continuar', 'retocar'] as const).map((kind) => schemaText(versionsSchema(mode, kind))),
  )
  .reduce((largo, texto) => (texto.length > largo.length ? texto : largo));

/** El más largo de varios textos. */
function elMasLargo(textos: readonly string[]): string {
  return textos.reduce((largo, texto) => (texto.length > largo.length ? texto : largo), '');
}

/** Las veinticuatro tonalidades, como las manda el cliente: tónica con sostenidos. */
const TONALIDADES = SHARP_NAMES.flatMap((tonic, indice) =>
  (['major', 'minor'] as const).map((mode: KeyMode) => ({
    nombre: { tonic, mode },
    clase: { tonic: indice as PitchClass, mode },
  })),
);

/**
 * El prompt del profesor más largo que se puede mandar, **medido y no supuesto**.
 *
 * Reservaba trescientos caracteres a ojo para los datos de la tonalidad. Desde que
 * el prompt lleva la tabla de acordes y hasta dos entradas del glosario
 * (adr/0076), eso son más de seiscientos, y el número a ojo habría dejado pasar
 * un prompt que se come el presupuesto entero. Así que se construye con cada pieza
 * en su peor caso: la cabecera y la tabla de la tonalidad más larga de las
 * veinticuatro, la escala de nombre más largo, la unidad de título más largo, las
 * **dos** entradas más largas del glosario —cada una en su peor tonalidad— y la
 * pregunta hasta su tope, con sus dos marcas.
 */
function peorPromptDelProfesor(): string {
  const referencias = GLOSSARY.map((entrada) =>
    elMasLargo(TONALIDADES.map(({ clase }) => theoryReference(entrada, clase))),
  )
    .sort((a, b) => b.length - a.length)
    .slice(0, 2)
    .map((referencia) => `- ${referencia}`);
  const marca = '###PREGUNTA###';

  return [
    elMasLargo(
      TONALIDADES.map(({ nombre }) => cabeceraDePrompt(nombre, degreesFor(nombre.mode)).join('\n')),
    ),
    elMasLargo(TONALIDADES.map(({ clase }) => keyChordTable(clase))),
    elMasLargo(SCALE_IDS.map(lineaDeEscala)),
    elMasLargo(COURSES.flatMap((curso) => curso.units.map((unidad) => lineaDeTema(unidad.title)))),
    CABECERA_DE_TEORIA,
    ...referencias,
    `${marca}\n${'x'.repeat(MAX_QUESTION_LENGTH)}\n${marca}`,
  ].join('\n');
}

describe('el presupuesto de tokens del profesor', () => {
  it('el prompt de sistema, el esquema y el peor prompt de verdad caben', () => {
    const estimado = estimatedTokens(
      TEACHER_SYSTEM_PROMPT,
      schemaText(ANSWER_SCHEMA),
      peorPromptDelProfesor(),
    );

    expect(estimado).toBeLessThanOrEqual(TOKEN_BUDGETS.profesor.input);
  });

  // Si esto falla, no es que el test esté mal: es que el prompt ha crecido tanto
  // que el modelo de coste está mintiendo y hay que recalcular los cupos.
  it('queda holgura, para que un retoque del prompt no descuadre los cupos', () => {
    const estimado = estimatedTokens(TEACHER_SYSTEM_PROMPT, schemaText(ANSWER_SCHEMA));

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.profesor.input * 0.7);
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
});

describe('el presupuesto de tokens de las versiones', () => {
  it('el prompt, el esquema, la progresión más larga y el catálogo caben', () => {
    // Lo peor: la progresión entera hasta su tope con sus pulsos, más los cinco
    // movimientos con su nombre y su porqué, más los grados válidos. Al retocar
    // va numerada —es lo que cuenta `desde`—, y eso es lo más largo que puede
    // ser. Los ejemplos de retocar se miden aparte, en
    // `features/versions/prompt.test.ts`: desde aquí no se puede abrir `features/`.
    const progresion = '32: V/iii x16 | '.repeat(MAX_VERSION_DEGREES);
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
    // Si dejara de serlo, `worstFeature` estaría calculando el cupo de Medio y
    // Pro con la petición equivocada y el margen saldría
    // mal.
    const versiones = TOKEN_BUDGETS.versiones;
    const profesor = TOKEN_BUDGETS.profesor;
    expect(versiones.input + versiones.output).toBeGreaterThan(profesor.input + profesor.output);
  });
});

/**
 * Al retocar, cada salida trae `desde` —el compás donde empieza lo que devuelve— y
 * solo el trozo que cambia (adr/0086). El esquema lo exige porque el validador lo
 * exige: lo que el esquema no pide, el modelo no lo pone.
 */
describe('el esquema de las salidas', () => {
  /** Lo que se pide de una salida, y de los compases de su parte. */
  function salida(mode: KeyMode, kind: 'continuar' | 'retocar') {
    const schema = versionsSchema(mode, kind) as {
      properties: {
        versions: {
          items: {
            properties: Record<string, Record<string, unknown>> & {
              sections: { items: { properties: { steps: { minItems: number } } } };
            };
            required: string[];
          };
        };
      };
    };
    return schema.properties.versions.items;
  }

  it('al retocar, desde es un entero obligatorio, de uno al tope de compases', () => {
    for (const mode of ['major', 'minor'] as const) {
      const items = salida(mode, 'retocar');

      expect(items.required).toContain('desde');
      expect(items.properties['desde']).toEqual({
        type: 'integer',
        minimum: 1,
        maximum: MAX_VERSION_DEGREES,
      });
    }
  });

  it('va detrás del camino y delante de los compases: se decide antes de escribirlos', () => {
    const orden = Object.keys(salida('major', 'retocar').properties);

    expect(orden.indexOf('desde')).toBe(orden.indexOf('path') + 1);
    expect(orden.indexOf('desde')).toBeLessThan(orden.indexOf('sections'));
  });

  it('y un trozo de un compás vale: cambiar un acorde es lo normal', () => {
    expect(salida('major', 'retocar').properties.sections.items.properties.steps.minItems).toBe(1);
  });

  it('al continuar no hay desde, y una parte nueva sigue midiendo dos compases', () => {
    const items = salida('minor', 'continuar');

    expect(items.properties).not.toHaveProperty('desde');
    expect(items.required).not.toContain('desde');
    expect(items.properties.sections.items.properties.steps.minItems).toBe(2);
  });
});

describe('la puerta del modelo', () => {
  /**
   * `hasModelKey` estuvo escrita y sin llamar desde la fase 5, y su ausencia
   * costaba dinero de verdad: `spendAi` gasta la petición **antes** de hablar con
   * el modelo, así que sin proveedor configurado alguien se quedaba sin
   * peticiones del mes por una variable de entorno que faltaba.
   *
   * Esto lo vigilaba leyendo las rutas y comparando en qué línea aparecía
   * cada llamada. Funcionaba, pero era un test de texto sobre tres ficheros, y
   * bastaba mover una línea al refactorizar para perderlo. **Ahora la garantía es
   * estructural**: las rutas no gastan cupo por su cuenta, y quien lo gasta
   * comprueba el proveedor primero porque es la misma función.
   *
   * Y desde que el cuerpo de las rutas vive también en un solo sitio
   * —`ai-route.ts`—, lo que hay que comprobar es aún menos: que ninguna ruta se
   * escriba su propio cuerpo, y que el que hay pasa por la puerta.
   */
  it('ninguna ruta gasta cupo por su cuenta ni habla con el modelo a solas', () => {
    for (const ruta of ['teacher', 'versiones']) {
      const codigo = readFileSync(
        fileURLToPath(new URL(`../app/api/${ruta}/route.ts`, import.meta.url)),
        'utf8',
      );

      expect(codigo, `${ruta} llama a spendAi sin pasar por la puerta`).not.toContain('spendAi');
      expect(codigo, `${ruta} llama al modelo por su cuenta`).not.toContain('askModel(');
      expect(codigo, `${ruta} no usa el cuerpo común`).toContain('responderConModelo');
    }
  });

  it('el cuerpo común pasa por la puerta antes de hablar con el modelo', () => {
    const codigo = readFileSync(fileURLToPath(new URL('./ai-route.ts', import.meta.url)), 'utf8');
    const puerta = codigo.indexOf('await abrirPuertaDeIa(');
    const modelo = codigo.indexOf('await askModel(');

    expect(puerta).toBeGreaterThan(-1);
    expect(modelo).toBeGreaterThan(-1);
    expect(puerta, 'habla con el modelo antes de abrir la puerta').toBeLessThan(modelo);
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
