import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MAX_QUESTION_LENGTH, MAX_SALIDAS, TOKEN_BUDGETS } from '@core/billing';
import {
  COURSES,
  degreesFor,
  GLOSSARY,
  keyChordTable,
  MAX_SALIDAS_POSIBLES,
  SHARP_NAMES,
  SCALE_IDS,
  theoryReference,
  type KeyMode,
  type PitchClass,
} from '@core/music';

import { marcaConClave } from '@core/marca';

import {
  ANSWER_SCHEMA,
  CABECERA_DE_TEORIA,
  cabeceraDePrompt,
  lineaDeEscala,
  lineaDeTema,
  RECORDATORIO_DE_LA_PREGUNTA,
  TEACHER_SYSTEM_PROMPT,
  salidasSchema,
  SALIDAS_SYSTEM_PROMPT,
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
 * El esquema de salidas más largo de los que se pueden mandar: el del menú más
 * largo, porque el enumerado del número tiene tantos valores como salidas. Se
 * calcula en vez de escribirse.
 */
const SALIDAS_SCHEMA_MAS_LARGO = schemaText(salidasSchema(MAX_SALIDAS_POSIBLES));

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
 * pregunta hasta su tope, con sus dos marcas y el recordatorio que va detrás.
 */
function peorPromptDelProfesor(): string {
  const referencias = GLOSSARY.map((entrada) =>
    elMasLargo(TONALIDADES.map(({ clase }) => theoryReference(entrada, clase))),
  )
    .sort((a, b) => b.length - a.length)
    .slice(0, 2)
    .map((referencia) => `- ${referencia}`);
  // Con su clave, que mide siempre lo mismo (adr/0115).
  const marca = marcaConClave('PREGUNTA', 'ffffff');

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
    RECORDATORIO_DE_LA_PREGUNTA,
  ].join('\n');
}

describe('el presupuesto de tokens del profesor', () => {
  it('el prompt de sistema, el esquema y el peor prompt de verdad caben', () => {
    const estimado = estimatedTokens(
      TEACHER_SYSTEM_PROMPT,
      schemaText(ANSWER_SCHEMA),
      peorPromptDelProfesor(),
    );

    console.log(`peor prompt del profesor: ${estimado} tokens de ${TOKEN_BUDGETS.profesor.input}`);
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

/**
 * **El peor prompt de verdad de las salidas no se mide aquí**, y no por descuido:
 * lo arma `features/salidas/prompt.ts`, que esta capa no puede abrir —la regla
 * 5—. El estimado que había aquí sumaba la progresión, los movimientos y los
 * grados, y se dejaba fuera el mapa de saltos, las cadencias, las directrices y
 * los ejemplos de retocar: decía que cabía mientras el peor prompt real rondaba
 * los 1.950 tokens. Ahora lo mide `app/api/salidas/presupuesto.test.ts`, que ve
 * las dos capas y construye el peor caso con las piezas de verdad.
 *
 * Aquí queda lo que sí se ve desde aquí: el prompt de sistema y el esquema, que
 * van en todas.
 */
describe('el presupuesto de tokens de las versiones', () => {
  it('el prompt de sistema y el esquema dejan holgura para el menú', () => {
    const estimado = estimatedTokens(SALIDAS_SYSTEM_PROMPT, SALIDAS_SCHEMA_MAS_LARGO);

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.salidas.input * 0.5);
  });

  it('hay sitio de salida para tres salidas con su título y su porqué', () => {
    // Cada una es un número, un título de sesenta caracteres y un porqué de
    // doscientos: unos 90 tokens con el JSON. El tope de 900 venía de cuando se
    // devolvían treinta y dos compases por salida, y bajarlo cambia los cupos:
    // eso no se decide aquí.
    // Sesenta y doscientos son los topes del contrato (`features/salidas`), que
    // desde aquí no se puede abrir.
    const porSalida = Math.ceil((60 + 200 + 40) / CHARS_PER_TOKEN);
    expect(TOKEN_BUDGETS.salidas.output).toBeGreaterThanOrEqual(MAX_SALIDAS * porSalida);
  });

  it('una tanda de versiones es lo más caro que se puede pedir', () => {
    // Si dejara de serlo, `worstFeature` estaría calculando el cupo de Medio y
    // Pro con la petición equivocada y el margen saldría
    // mal.
    const versiones = TOKEN_BUDGETS.salidas;
    const profesor = TOKEN_BUDGETS.profesor;
    expect(versiones.input + versiones.output).toBeGreaterThan(profesor.input + profesor.output);
  });
});

/**
 * El modelo elige del menú: cada salida es un número, un título y un porqué. El
 * esquema lo exige porque el validador lo exige: lo que el esquema no pide, el
 * modelo no lo pone.
 */
describe('el esquema de las salidas', () => {
  /** Lo que se pide de una salida. */
  function salida(opciones: number) {
    const schema = salidasSchema(opciones) as {
      properties: {
        versions: {
          minItems: number;
          maxItems: number;
          items: { properties: Record<string, Record<string, unknown>>; required: string[] };
        };
      };
    };
    return schema.properties.versions;
  }

  it('el número es un enumerado de uno a cuantas haya: no puede elegir una que no está', () => {
    expect(salida(5).items.properties['opcion']).toEqual({
      type: 'integer',
      enum: [1, 2, 3, 4, 5],
    });
  });

  it('va primero, y lo demás es obligatorio: decide cuál antes de decir por qué', () => {
    const { items } = salida(3);

    expect(Object.keys(items.properties)).toEqual(['opcion', 'title', 'why']);
    expect(items.required).toEqual(['opcion', 'title', 'why']);
  });

  it('de una a tres salidas cuando elige', () => {
    expect(salida(9)).toMatchObject({ minItems: 1, maxItems: MAX_SALIDAS });
  });

  /**
   * Cuando solo explica, el menú son las tres mejores y las cuenta todas: una que
   * se callara sería una de las tres mejores que no llega a la pantalla.
   */
  it('cuando las explica, todas las del menú, y nunca más de tres ni un suelo vacío', () => {
    const todas = (opciones: number) =>
      (salidasSchema(opciones, true) as { properties: { versions: { minItems: number } } })
        .properties.versions.minItems;

    expect(todas(3)).toBe(3);
    expect(todas(2)).toBe(2);
    expect(todas(9)).toBe(MAX_SALIDAS);
    expect(todas(0)).toBe(1);
  });

  it('un menú vacío no deja un enumerado vacío, que no es un esquema', () => {
    expect(salida(0).items.properties['opcion']?.['enum']).toEqual([1]);
  });
});

/**
 * Lo que el prompt de sistema de las salidas le dice al modelo y no le dice nadie
 * más: qué quiere decir cada color —las líneas del menú solo dicen la palabra—, que
 * el porqué cuenta el «Por qué» del juez y que las directrices son un dato. Que el
 * menú va ordenado, que sin directrices se cuentan todas y que con ellas se eligen
 * hasta tres lo dice el prompt de cada petición en su última línea
 * (`features/salidas/prompt.ts`) y lo obliga el esquema.
 */
describe('el prompt de sistema de las salidas', () => {
  it('pide el número de la salida, y no repite lo que ya dicen el prompt y el esquema', () => {
    expect(SALIDAS_SYSTEM_PROMPT).toMatch(/pon su numero en\s+opcion/u);
    expect(SALIDAS_SYSTEM_PROMPT).not.toMatch(/cuentalas todas/u);
    expect(SALIDAS_SYSTEM_PROMPT).not.toMatch(/hasta tres/u);
    expect(SALIDAS_SYSTEM_PROMPT).not.toMatch(/de mas a menos/u);
  });

  it('explica una vez los colores que el menú dice en una palabra', () => {
    for (const color of ['oscurece', 'aclara', 'prestado', 'abierto']) {
      expect(SALIDAS_SYSTEM_PROMPT).toContain(color);
    }
  });

  it('pide que el porqué cuente el del juez, y lo de siempre sobre lo dudoso y el cierre', () => {
    expect(SALIDAS_SYSTEM_PROMPT).toContain('Por que');
    // La marca con su clave, y que solo la cierra la misma (adr/0115).
    expect(SALIDAS_SYSTEM_PROMPT).toMatch(/entre dos ###DIRECTRICES-clave###\s+iguales/u);
    expect(SALIDAS_SYSTEM_PROMPT).toMatch(/Un\s+compas con \?/u);
    expect(SALIDAS_SYSTEM_PROMPT).toMatch(/no digas que\s+cierra/u);
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
    for (const ruta of ['teacher', 'salidas']) {
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
    const modelo = codigo.indexOf('await preguntarAlModelo(');

    expect(puerta).toBeGreaterThan(-1);
    expect(modelo).toBeGreaterThan(-1);
    expect(puerta, 'habla con el modelo antes de abrir la puerta').toBeLessThan(modelo);
    // Y el cuerpo no llama al modelo por otro sitio que por el bucle de los intentos.
    expect(codigo).not.toContain('askModel(');
  });

  it('el bucle de los intentos es el único que llama al modelo', () => {
    const codigo = readFileSync(
      fileURLToPath(new URL('./ai-intentos.ts', import.meta.url)),
      'utf8',
    );

    expect(codigo).toContain('await askModel(');
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

describe('la escala en el prompt del profesor', () => {
  it('va con su nombre y no con su identificador, que el modelo copiaba tal cual', () => {
    expect(lineaDeEscala('minorPentatonic')).toBe('Escala que está usando: pentatónica menor.');
  });
});
