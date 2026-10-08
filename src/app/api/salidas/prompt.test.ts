import { describe, expect, it } from 'vitest';

import { MAX_DIRECTRICES_LENGTH } from '@core/billing';
import {
  degreesFor,
  resolveDegree,
  roleInfo,
  salidasPosibles,
  STYLE_IDS,
  type DegreeSymbol,
  type KeyMode,
} from '@core/music';

import { seSostiene } from '@features/salidas/contract';
import type { SalidasRequest } from '@features/salidas/peticion';

/** La marca con la clave fija que se le da en estas pruebas. */
const MARCA_DIRECTRICES = '###DIRECTRICES-d1e7a5###';
import {
  COLORES,
  contextoDe,
  MAX_OPCIONES_DEL_MENU,
  menuDe,
  salidasDe,
} from '@features/salidas/menu';
import {
  enAcordes,
  MAX_CARACTERES_DEL_PROMPT,
  MAX_CARACTERES_DEL_PUNTEO,
  menuDelPrompt,
  promptDeSalidas,
} from './prompt';

/**
 * El prompt de las salidas: el menú que construye el dominio, numerado y ordenado
 * por el juez, y lo justo para elegir bien de él y explicar por qué.
 *
 * Antes llevaba el catálogo de caminos y de movimientos, el mapa de saltos, las
 * cadencias y un ejemplo de cada retoque, y `qwen3:8b` copiaba el ejemplo 21
 * veces de 22. Lo que se prueba aquí es que el menú que lee es el que luego se
 * valida, que lleva el contexto con el que se juzgó —estilo, compás, especies,
 * punteo, papel— y que cada salida trae el porqué del juez para que el modelo no
 * se invente el suyo.
 */

const EN_DO: SalidasRequest = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'retocar',
  progression: [
    { degree: 'I', beats: 4 },
    { degree: 'V', beats: 4, heard: true },
    { degree: 'vi', beats: 4 },
    { degree: 'IV', beats: 4 },
  ],
};

/** El prompt con la cabecera que pone la ruta. */
function prompt(request: SalidasRequest): string {
  return promptDeSalidas(request, ['Tonalidad: C mayor.'], () => 'd1e7a5');
}

/** Un grado escrito en una frase: el patrón con el que lee la tabla lo que hace cada salida. */
const GRADO_ESCRITO =
  /(?<![\p{L}/#\d])(b?(?:VII|VI|IV|III|II|V|I|vii|vi|iv|iii|ii|v|i)°?(?:\/(?:ii|iii|iv|vi|V))?)(?![\p{L}\d°/])/gu;

/** Las líneas del menú. */
function lineasDelMenu(texto: string): string[] {
  return texto.split('\n').filter((linea) => /^\d+\. /u.test(linea));
}

describe('el prompt de las salidas', () => {
  it('empieza por la cabecera que le pasan y la tabla de acordes de la tonalidad', () => {
    const [cabecera, tabla] = prompt(EN_DO).split('\n');

    expect(cabecera).toBe('Tonalidad: C mayor.');
    // Los tuyos, en el orden de la tonalidad.
    expect(tabla).toMatch(/^Acordes por grado: I=C .*IV=F V=G vi=Am/u);
  });

  /**
   * **La tabla lleva los grados que salen, no los dieciséis.** Un grado que no está
   * ni en lo tuyo ni en el menú no lo puede nombrar el porqué —el validador lo
   * taparía—, y con sus especies la tabla llegaba a 330 caracteres.
   */
  it('la tabla lleva los grados tuyos, los del menú y los que dice lo que hace cada salida', () => {
    // Al continuar un solo acorde, el menú trae grados que no son tuyos.
    const soloI: SalidasRequest = {
      ...EN_DO,
      kind: 'continuar',
      progression: [{ degree: 'I', beats: 4 }],
    };
    for (const request of [EN_DO, soloI]) {
      const menu = menuDe(request);
      const salen = new Set<string>([
        ...request.progression.map((paso) => paso.degree),
        ...menu.flatMap(({ salida }) => [
          ...salida.secciones.flatMap((seccion) => seccion.steps.map((paso) => paso.degree)),
          ...[...salida.que.matchAll(GRADO_ESCRITO)].map((dicho) => dicho[1]!),
        ]),
      ]);
      const esperada = (degreesFor('major') as readonly string[])
        .filter((grado) => salen.has(grado))
        .map((grado) => `${grado}=${resolveDegree(0, 'major', grado as DegreeSymbol).symbol}`);

      expect(prompt(request).split('\n')[1]).toBe(`Acordes por grado: ${esperada.join(' ')}`);
      expect(esperada.length).toBeGreaterThan(request.progression.length);
      expect(esperada.length).toBeLessThan(degreesFor('major').length);
    }
  });

  /**
   * El prompt de sistema promete que los compases oídos van marcados, y no se
   * marcaba ninguno: llegaban iguales al modelo los escritos y los dudosos.
   */
  it('tus compases van numerados, y el que oyó el micro sin confirmar lleva su interrogación', () => {
    expect(prompt(EN_DO)).toContain('Sus compases, de 4 pulsos cada uno: 1:I | 2:V? | 3:vi | 4:IV');
  });

  it('si no todos duran lo mismo, cada uno dice sus pulsos', () => {
    const desigual: SalidasRequest = {
      ...EN_DO,
      progression: [
        { degree: 'I', beats: 5 },
        { degree: 'V', beats: 3, heard: true },
      ],
    };

    expect(prompt(desigual)).toContain('Sus compases (grado y pulsos): 1:I x5 | 2:V x3?');
  });

  /**
   * Un blues en `I7 IV7 V7` llegaba como `I IV V`, y el porqué hablaba de un G
   * donde sonaba un G7.
   */
  it('la especie va con su cifrado en tus compases, y en la tabla la tríada', () => {
    const conEspecie: SalidasRequest = {
      ...EN_DO,
      progression: [
        { degree: 'I', beats: 4, especie: 'major7' },
        { degree: 'V', beats: 4, especie: 'dominant7' },
        { degree: 'V', beats: 4 },
        { degree: 'I', beats: 4, especie: 'quinta' },
      ],
    };
    const texto = prompt(conEspecie);

    expect(texto).toContain('1:I=Cmaj7 | 2:V=G7 | 3:V | 4:I=C5');
    // En la tabla, la tríada: es como suena el grado en lo que añade una salida, y
    // la especie ya va en tu compás. Dicha dos veces eran caracteres sin nada nuevo.
    expect(texto).toMatch(/Acordes por grado: I=C .*V=G( |$)/mu);
    expect(texto).not.toContain('C/Cmaj7');
  });

  it('el estilo y el compás van en su línea, y sin ellos no va', () => {
    expect(prompt({ ...EN_DO, estilo: 'jazz', pulsosPorCompas: 3 })).toContain(
      '\nEstilo: jazz. Compás de 3 pulsos.\n',
    );
    expect(prompt({ ...EN_DO, estilo: 'rock' })).toContain('\nEstilo: rock.\n');
    expect(prompt({ ...EN_DO, pulsosPorCompas: 6 })).toContain('\nCompás de 6 pulsos.\n');
    expect(prompt(EN_DO)).not.toMatch(/Estilo|Compás de/u);
  });

  /**
   * Las notas fuertes, con su nombre en la tonalidad: son las que tienen que caber
   * en el acorde. Un compás sin ninguna fuerte dice las que tenga.
   */
  it('el punteo dice sus notas fuertes compás a compás, con su nombre', () => {
    const conPunteo: SalidasRequest = {
      ...EN_DO,
      key: { tonic: 'F', mode: 'major' },
      progression: [
        {
          degree: 'I',
          beats: 4,
          notas: [
            { nota: 4, fuerte: true },
            { nota: 7, fuerte: false },
          ],
        },
        { degree: 'V', beats: 4 },
        { degree: 'IV', beats: 4, notas: [{ nota: 5, fuerte: false }] },
      ],
    };

    // En Fa mayor, con bemoles: la cuarta es Bb.
    expect(promptDeSalidas(conPunteo, [])).toContain(
      '\nPunteo encima (notas fuertes): 1:A | 3:Bb\n',
    );
    expect(prompt(EN_DO)).not.toContain('Punteo');
  });

  it('un punteo largo se corta por un compás entero, y lo dice', () => {
    const largo: SalidasRequest = {
      ...EN_DO,
      progression: Array.from({ length: 32 }, () => ({
        degree: 'I' as const,
        beats: 4,
        notas: Array.from({ length: 12 }, (_, nota) => ({ nota, fuerte: true })),
      })),
    };
    const linea = prompt(largo)
      .split('\n')
      .find((l) => l.startsWith('Punteo'))!;

    expect(linea.length).toBeLessThanOrEqual(MAX_CARACTERES_DEL_PUNTEO);
    expect(linea).toMatch(/^Punteo encima \(notas fuertes\): 1:C C# D .* …$/u);
  });

  it('el menú va numerado, y es el mismo que se valida', () => {
    const texto = prompt(EN_DO);
    // Con el contexto de la petición, que es con el que lo construye la ruta, y
    // hasta donde cabe en el prompt.
    const menu = salidasDe(EN_DO);
    const todas = salidasPosibles('major', 'retocar', EN_DO.progression, contextoDe(EN_DO));

    expect(menu.length).toBeGreaterThan(0);
    expect(menu.length).toBeLessThanOrEqual(MAX_OPCIONES_DEL_MENU);
    expect(todas.slice(0, menu.length)).toEqual(menu);
    menu.forEach((salida, i) => {
      expect(texto).toContain(`${i + 1}. ${salida.path}: ${salida.que} [`);
    });
  });

  it('cada salida dice hacia dónde tira, con las palabras de los colores', () => {
    const palabras = Object.values(COLORES).sort((a, b) => b.length - a.length);
    const lineas = lineasDelMenu(prompt(EN_DO));
    expect(lineas.length).toBeGreaterThan(0);
    for (const linea of lineas) {
      const lista = /\[([^\]]*)\]/u.exec(linea)?.[1] ?? '';
      const resto = palabras.reduce((texto, palabra) => texto.split(palabra).join('#'), lista);
      expect(resto, linea).toMatch(/^#(, #)*$/u);
    }
  });

  /**
   * **El porqué del juez va con cada salida**: sin él, el modelo se inventaba el
   * suyo, y lo que se inventaba era que cerraba lo que se quedaba abierto. Solo
   * los motivos que pasan el validador del porqué.
   */
  it('cada salida lleva los motivos del juez que se sostienen, con sus acordes', () => {
    const lineas = lineasDelMenu(prompt(EN_DO));
    const menu = menuDelPrompt(EN_DO, ['Tonalidad: C mayor.']);

    expect(lineas.some((linea) => linea.includes(' Por qué: '))).toBe(true);
    menu.forEach(({ salida, motivos }, i) => {
      for (const motivo of motivos) {
        expect(lineas[i]).toContain(motivo);
        expect(seSostiene(motivo, salida, EN_DO)).toBe(true);
      }
    });
  });

  /**
   * El modelo copia los motivos tal cual —223 de 240 porqués en el corpus—, así
   * que van con los acordes que suenan, como se leen en el panel.
   */
  it('los grados de un motivo se cambian por sus acordes, y lo que no es un grado se queda', () => {
    expect(enAcordes('V I en el 8: cadencia perfecta.', EN_DO)).toBe(
      'G C en el 8: cadencia perfecta.',
    );
    expect(enAcordes('V/vi vi: la secundaria; IV por iv; vii° I.', EN_DO)).toBe(
      'E Am: la secundaria; F por Fm; Bdim C.',
    );
    const enLa: SalidasRequest = { ...EN_DO, key: { tonic: 'A', mode: 'minor' } };
    expect(enAcordes('VII i: cierra sin sensible, y la I no existe aquí.', enLa)).toBe(
      'G Am: cierra sin sensible, y la I no existe aquí.',
    );
    expect(enAcordes('Cambia 2 de 4 compases.', EN_DO)).toBe('Cambia 2 de 4 compases.');
  });

  it('dice qué se quiere hacer, cómo va el menú, y qué es lo que le mandan', () => {
    const conDirectrices = { ...EN_DO, directrices: 'más triste' };
    expect(prompt(conDirectrices)).toContain(
      'Quiere retocar estos compases sin salir de ellos. Salidas, de más a menos encaje:',
    );
    expect(prompt({ ...conDirectrices, kind: 'continuar' })).toContain(
      'Quiere seguir su canción. Salidas, de más a menos encaje:',
    );
    // Sin directrices no hay nada que elegir: son las que mejor encajan.
    expect(prompt(EN_DO)).toContain(
      'Quiere retocar estos compases sin salir de ellos. Las salidas que mejor encajan:',
    );
    expect(prompt({ ...EN_DO, kind: 'continuar' })).toContain(
      'Quiere seguir su canción. Las salidas que mejor encajan:',
    );
    // Sin decirlo, una idea: también se le dice.
    expect(prompt(EN_DO)).toContain('Parte: una idea.');
    expect(prompt({ ...EN_DO, role: 'estribillo' })).toContain('Parte: estribillo.');
    // El nombre y no la frase que se lee en pantalla: esa es para quien compone.
    expect(prompt({ ...EN_DO, role: 'estribillo' })).not.toContain(roleInfo('estribillo').what);
  });

  /**
   * **Sin directrices no elige: explica.** El menú son las tres mejores, y se le
   * pide que las cuente todas en el orden que quiera; con directrices, que elija.
   */
  it('sin directrices pide contarlas todas; con ellas, las que vayan hacia lo que pide', () => {
    const sin = prompt(EN_DO);
    expect(
      sin.endsWith(
        'Cuéntalas todas, cada una una vez y en el orden que mejor las explique, con su porqué.',
      ),
    ).toBe(true);
    expect(sin.split('\n').filter((linea) => /^\d+\. /u.test(linea))).toHaveLength(3);
    expect(prompt({ ...EN_DO, directrices: 'más triste' })).toContain(
      'Elige hasta tres distintas, las que vayan hacia lo que pide, y cuenta su porqué.',
    );
  });

  it('ya no lleva el mapa, las cadencias ni los ejemplos: no hay nada que construir', () => {
    const texto = prompt(EN_DO);

    expect(texto).not.toContain('Mapa de saltos');
    expect(texto).not.toContain('Con lo demas, queda');
    expect(texto).not.toContain('Movimientos, solo para rearmonizar');
  });

  it('las directrices van al final, entre sus marcas, y sin ellas no va nada', () => {
    const con = prompt({ ...EN_DO, directrices: 'más triste' });

    expect(con.endsWith(`${MARCA_DIRECTRICES}\nmás triste\n${MARCA_DIRECTRICES}`)).toBe(true);
    expect(prompt(EN_DO)).not.toContain('###DIRECTRICES');
  });
});

/**
 * **El menú ocupa lo que deja el resto**, y eso es lo que hace del presupuesto un
 * tope. Se quita por el final: primero los motivos, luego las salidas.
 */
describe('el menú en el sitio que queda', () => {
  it('con poco resto van las seis con sus motivos, y es el mismo menú', () => {
    const menu = menuDelPrompt(EN_DO, []);
    const entero = menuDe(EN_DO, (motivo, salida) =>
      seSostiene(enAcordes(motivo, EN_DO), salida, EN_DO),
    );

    expect(menu.map((o) => o.salida)).toEqual(entero.map((o) => o.salida));
    expect(menu.map((o) => o.motivos)).toEqual(
      entero.map((o) => o.motivos.map((m) => enAcordes(m, EN_DO))),
    );
  });

  it('con el resto lleno, se callan motivos y salidas por el final, y el prompt no pasa de su tope', () => {
    // Una cabecera que se come casi todo el sitio, como lo haría el peor resto.
    const sitio = (cabecera: string) => {
      const menu = menuDelPrompt(EN_DO, [cabecera]);
      return { menu, texto: promptDeSalidas(EN_DO, [cabecera]) };
    };
    const entero = menuDelPrompt(EN_DO, []);
    let vistos = entero.length;
    let sinMotivos = false;
    for (let largo = 1800; largo <= MAX_CARACTERES_DEL_PROMPT; largo += 50) {
      const { menu, texto } = sitio('x'.repeat(largo));
      // Mientras quepa alguna salida, el prompt no pasa de su tope; lo que ya no
      // cabe sin el menú lo cuida el presupuesto, que no deja un resto así.
      if (menu.length > 0) expect(texto.length).toBeLessThanOrEqual(MAX_CARACTERES_DEL_PROMPT);
      // Un principio del menú entero, con los mismos números.
      expect(menu.map((o) => o.salida)).toEqual(entero.slice(0, menu.length).map((o) => o.salida));
      menu.forEach((opcion, i) => {
        expect(entero[i]!.motivos.slice(0, opcion.motivos.length)).toEqual(opcion.motivos);
      });
      expect(menu.length).toBeLessThanOrEqual(vistos);
      vistos = menu.length;
      sinMotivos ||= menu.some((opcion, i) => opcion.motivos.length < entero[i]!.motivos.length);
    }
    expect(sinMotivos).toBe(true);
    expect(vistos).toBe(0);
  });

  it('las directrices enteras también cuentan en el sitio', () => {
    const con = { ...EN_DO, directrices: 'x'.repeat(MAX_DIRECTRICES_LENGTH) };

    expect(prompt(con).length).toBeLessThanOrEqual(MAX_CARACTERES_DEL_PROMPT);
  });
});

// Venía de `features/salidas/contract.test.ts`: mira el validador del contrato con
// los motivos dichos como los ve el modelo (`enAcordes`), y eso es de este prompt.
describe('lo que dice el juez, en acordes', () => {
  /**
   * **Y los motivos del juez**, dichos en acordes como los ve el modelo. Antes 1.862
   * de 52.758 no pasaban y se callaban en el prompt: el validador leía «la dominante
   * resuelve en la tónica» de un enlace —la vuelta del bucle, el compás 3— como si
   * hablara del final de la canción, y leía grados dentro de nombres («el II mayor»,
   * «salta un tritono»). Ahora **cada frase se comprueba en el sitio que nombra**
   * (`loQueNoEsVerdad`), y los motivos se escriben con lo que hay. Dieciséis
   * progresiones, con séptimas y sin ellas, sin estilo y con los doce, al continuar y
   * al retocar.
   */
  it('lo que dice el juez de cada salida también pasa siempre', { timeout: 60_000 }, () => {
    const progresiones: readonly [KeyMode, SalidasRequest['key']['tonic'], string][] = [
      ['major', 'E', 'I I I I IV IV I I V IV I V'],
      ['major', 'E', 'I IV I I IV IV I I V IV I I'],
      ['major', 'A', 'I I I I IV IV I I'],
      ['major', 'A', 'I IV I I IV IV I I'],
      ['minor', 'A', 'i i i i iv iv i i v iv i v'],
      ['minor', 'A', 'i iv i i iv iv i i V iv i V'],
      ['major', 'C', 'I V vi IV'],
      ['major', 'C', 'ii V I I'],
      ['major', 'G', 'I vi IV V'],
      ['major', 'D', 'I IV V IV'],
      ['minor', 'A', 'i VII VI V'],
      ['minor', 'E', 'i VI III VII'],
      ['minor', 'D', 'i iv v i'],
      ['major', 'F', 'I IV I V'],
      ['major', 'Bb', 'I V'],
      ['major', 'C', 'I'],
    ];
    const noPasan: string[] = [];
    let motivos = 0;
    for (const [mode, tonic, grados] of progresiones) {
      for (const especie of [undefined, 'dominant7'] as const) {
        for (const estilo of [undefined, ...STYLE_IDS]) {
          for (const kind of ['continuar', 'retocar'] as const) {
            const request: SalidasRequest = {
              key: { tonic, mode },
              kind,
              progression: grados.split(' ').map((degree) => ({
                degree: degree as DegreeSymbol,
                beats: 4,
                ...(especie === undefined ? {} : { especie }),
              })),
              ...(estilo === undefined ? {} : { estilo }),
            };
            const salidas = salidasPosibles(mode, kind, request.progression, contextoDe(request));
            for (const salida of salidas) {
              for (const { motivo } of salida.encaje?.criterios ?? []) {
                if (motivo === '') {
                  continue;
                }
                motivos += 1;
                const texto = enAcordes(motivo, request);
                if (!seSostiene(texto, salida, request)) {
                  noPasan.push(`${tonic} ${mode} ${grados} ${estilo ?? ''} ${kind}: ${texto}`);
                }
              }
            }
          }
        }
      }
    }
    expect(noPasan.slice(0, 10)).toEqual([]);
    expect(motivos).toBeGreaterThan(30_000);
  });
});
