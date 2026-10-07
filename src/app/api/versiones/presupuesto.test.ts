import { describe, expect, it } from 'vitest';

import { MAX_DIRECTRICES_LENGTH, MAX_VERSION_DEGREES, TOKEN_BUDGETS } from '@core/billing';
import {
  blockChord,
  degreesFor,
  nextDegrees,
  PATHS,
  pitchClassFromName,
  ROLES,
  SHARP_NAMES,
  STYLE_IDS,
  STYLES,
  writtenBlock,
  type DegreeSymbol,
  type EspecieDeBloque,
  type KeyMode,
  type NoteName,
} from '@core/music';

import { recortarALetras, tokensEnElPeorCaso } from '@core/marca';
import type { VersionsRequest, VersionStep } from '@features/versions/contract';
import { COLORES, MAX_OPCIONES_DEL_MENU } from '@features/versions/menu';
import {
  MAX_CARACTERES_DEL_PROMPT,
  menuDelPrompt,
  promptDeSalidas,
  salidasDe,
} from '@features/versions/prompt';
import { lineaDeTonalidad, versionsSchema, VERSIONS_SYSTEM_PROMPT } from '@server/prompts';

/**
 * **El peor prompt de verdad de las salidas**, medido con las piezas de verdad.
 *
 * Vive aquí y no en `server/prompts.test.ts` porque el prompt lo arma
 * `features/versions/prompt.ts` y `server/` no puede abrir `features/`: `app/` es
 * la única capa que ve las dos, y es donde la ruta las junta.
 *
 * El estimado que había allí sumaba la progresión, los movimientos y los grados,
 * y se dejaba el mapa de saltos, las cadencias, las directrices y los ejemplos de
 * retocar. Decía que cabía en los 1.400 tokens de `TOKEN_BUDGETS.versiones`
 * mientras el peor prompt real rondaba los 1.950, y de ese número salen los cupos
 * de Medio y Pro.
 *
 * Aquí se busca el peor: las veinticuatro tonalidades, las dos clases, el papel
 * más largo, las directrices hasta su tope, el estilo y el compás, un punteo en
 * cada compás, y cientos de canciones de treinta y dos compases con especies y el
 * menú que les toque. Con los mismos 3,2 caracteres por token que
 * `server/prompts.test.ts`, que es contar a favor del gasto.
 */
const CHARS_PER_TOKEN = 3.2;

/**
 * **Lo que tiene que sobrar del presupuesto en el peor caso**, en tokens.
 *
 * Llegó a sobrar 3: el peor prompt daba 1.396 de 1.400 y el tope 1.397, así que lo
 * siguiente que entrara —un estilo más, una frase más en el prompt de sistema—
 * obligaba a subir `TOKEN_BUDGETS`, que es bajar los cupos. Se hizo sitio quitando
 * lo que el modelo no usa para elegir ni para explicar (`features/versions/prompt.ts`,
 * `server/prompts.ts`), y esto vigila que el sitio siga ahí: quien lo gaste tiene
 * que venir aquí a decidirlo, no enterarse cuando falle.
 */
const HOLGURA = 120;

/** Lo que puede ocupar el prompt de una petición sin comerse la holgura. */
const CABE = TOKEN_BUDGETS.versiones.input - HOLGURA;

/** Todas las especies que puede llevar un compás. */
const ESPECIES: readonly EspecieDeBloque[] = [
  'major7',
  'dominant7',
  'minor7',
  'halfDiminished7',
  'diminished7',
  'minorMajor7',
  'augmentedMajor7',
  'quinta',
  'sus2',
  'sus4',
  'dim',
  'aug',
  'menor',
];

/**
 * El estilo de nombre más largo: es lo que más ocupa en su línea. **Leído de
 * `STYLES` al correr**, y no escrito aquí: un estilo nuevo de nombre más largo
 * entra solo en el peor caso.
 */
const ESTILO = STYLE_IDS.reduce((a, b) => (STYLES[b].name.length > STYLES[a].name.length ? b : a));

/** El papel de nombre más largo, por lo mismo: del papel solo viaja el nombre. */
const PAPEL = ROLES.reduce((largo, rol) => (rol.name.length > largo.name.length ? rol : largo));

/** Doce notas, todas en pulso fuerte: el punteo más largo que puede viajar. */
const PUNTEO = Array.from({ length: 12 }, (_, nota) => ({ nota, fuerte: true }));

/** Un generador con semilla: las mismas canciones cada vez. */
function aleatorio(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}

/**
 * Canciones del tope de compases, por el grafo, con pulsos, especies, punteo y
 * marcas de oído al azar.
 */
function canciones(mode: KeyMode, cuantas: number): VersionStep[][] {
  const azar = aleatorio(mode === 'major' ? 17 : 23);
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  return Array.from({ length: cuantas }, () => {
    const pasos: VersionStep[] = [];
    let grado = grados[Math.floor(azar() * grados.length)]!;
    for (let i = 0; i < MAX_VERSION_DEGREES; i += 1) {
      const especie = azar() < 0.5 ? ESPECIES[Math.floor(azar() * ESPECIES.length)] : undefined;
      pasos.push({
        degree: grado,
        beats: 1 + Math.floor(azar() * 16),
        heard: true,
        ...(especie === undefined ? {} : { especie }),
        ...(azar() < 0.5 ? { notas: PUNTEO } : {}),
      });
      const saltos = nextDegrees(mode, grado);
      grado = saltos[Math.floor(azar() * saltos.length)]!.to;
    }
    return pasos;
  });
}

function tokens(texto: string): number {
  return Math.ceil(texto.length / CHARS_PER_TOKEN);
}

/**
 * La entrada entera de una petición: el prompt de sistema, el esquema y el prompt.
 * El esquema, con tantas opciones como líneas del menú lleva el prompt, que es lo
 * que hace la ruta; contadas del texto para no construir el menú dos veces.
 */
function entrada(request: VersionsRequest): number {
  const prompt = promptDeSalidas(request, [lineaDeTonalidad(request.key)]);
  const opciones = prompt.split('\n').filter((linea) => /^\d+\. /u.test(linea)).length;
  return tokens(VERSIONS_SYSTEM_PROMPT + JSON.stringify(versionsSchema(opciones)) + prompt);
}

/**
 * La canción de treinta y dos compases que más ocupa en una tonalidad: cada
 * compás con el grado y la especie de cifrado más largo, todos distintos —así la
 * tabla también lleva treinta y dos acordes de más—, pulsos de dos cifras que no
 * se repiten todos, dudosos y con punteo.
 */
function laMasLarga(tonic: NoteName, mode: KeyMode): VersionStep[] {
  const tonica = pitchClassFromName(tonic);
  const combinaciones = (degreesFor(mode) as readonly DegreeSymbol[])
    .flatMap((degree) =>
      ESPECIES.map((especie) => ({
        degree,
        especie,
        largo: `${degree}=${blockChord(tonica, mode, writtenBlock('', degree, 1, especie)).symbol}`
          .length,
      })),
    )
    .sort((a, b) => b.largo - a.largo)
    .slice(0, MAX_VERSION_DEGREES);
  return combinaciones.map(({ degree, especie }, i) => ({
    degree,
    especie,
    beats: i % 2 === 0 ? 16 : 15,
    heard: true,
    notas: PUNTEO,
  }));
}

describe('el presupuesto de entrada de las salidas', () => {
  // Cientos de menús construidos y juzgados: con la cobertura midiendo, pasa de
  // los veinte segundos de tope.
  it('el peor prompt de verdad cabe en el presupuesto con su holgura', { timeout: 60_000 }, () => {
    const directrices = 'x'.repeat(MAX_DIRECTRICES_LENGTH);
    let peor = 0;

    for (const mode of ['major', 'minor'] as const) {
      const todas = canciones(mode, 150);
      for (const kind of ['continuar', 'retocar'] as const) {
        // Las canciones que sacan el prompt más largo, probadas en cada tonalidad:
        // lo que cambia de una a otra es lo que miden los acordes escritos.
        const largas = todas
          .map((progression) => {
            // Al continuar, con treinta y dos compases no cabe nada: el peor es el
            // de veintiséis, que todavía admite una parte nueva y su cierre.
            const pasos = kind === 'continuar' ? progression.slice(0, 26) : progression;
            const request: VersionsRequest = {
              key: { tonic: 'C', mode },
              kind,
              progression: pasos,
              role: PAPEL.id,
              estilo: ESTILO,
              pulsosPorCompas: 6,
              directrices,
            };
            return { request, largo: entrada(request) };
          })
          .sort((a, b) => b.largo - a.largo)
          .slice(0, 5);
        for (const { request } of largas) {
          for (const tonic of SHARP_NAMES as readonly NoteName[]) {
            peor = Math.max(peor, entrada({ ...request, key: { tonic, mode } }));
          }
        }
      }
    }

    // Si esto falla, no se sube el presupuesto aquí: subirlo baja los cupos de
    // Medio y Pro, y eso lo decide quien pone los precios.
    console.log(
      `peor prompt de salidas: ${peor} tokens de ${TOKEN_BUDGETS.versiones.input}; sobran ${TOKEN_BUDGETS.versiones.input - peor}`,
    );
    expect(peor).toBeLessThanOrEqual(CABE);
  });

  /**
   * **Y el tope, que es lo que de verdad garantiza el presupuesto**: la búsqueda
   * de arriba encuentra el peor que encuentra, y esto suma el prompt de sistema,
   * el esquema del menú más largo y el tope del prompt, que `menuDelPrompt` no
   * deja pasar porque el menú ocupa lo que deja el resto.
   */
  it('el prompt de sistema, el esquema y el tope del prompt, sumados, caben con su holgura', () => {
    const peor = tokens(
      VERSIONS_SYSTEM_PROMPT +
        JSON.stringify(versionsSchema(MAX_OPCIONES_DEL_MENU)) +
        'x'.repeat(MAX_CARACTERES_DEL_PROMPT),
    );

    console.log(
      `tope del prompt de salidas: ${peor} tokens de ${TOKEN_BUDGETS.versiones.input}; sobran ${TOKEN_BUDGETS.versiones.input - peor}`,
    );
    expect(peor).toBeLessThanOrEqual(CABE);
  });

  /**
   * **Y con las directrices en el peor alfabeto.** Veinticinco caracteres chinos
   * cuestan lo que 240 letras (`tokensEnElPeorCaso`) y miden 25: contadas por lo que
   * miden, el menú se comía los 215 que parecían sobrar y el prompt se pasaba en 67
   * tokens (adr/0115). Aquí cuentan lo que cuestan, y el resto a 3,2 por token.
   */
  it('con las directrices en chino, yi o emoji tampoco se pasa', { timeout: 60_000 }, () => {
    /** La entrada de una petición, con las directrices a lo que cuestan y lo demás a 3,2. */
    const enElPeorAlfabeto = (request: VersionsRequest): number => {
      const prompt = promptDeSalidas(request, [lineaDeTonalidad(request.key)]);
      const opciones = prompt.split('\n').filter((linea) => /^\d+\. /u.test(linea)).length;
      const resto =
        VERSIONS_SYSTEM_PROMPT +
        JSON.stringify(versionsSchema(opciones)) +
        prompt.replace(request.directrices!, '');
      return Math.ceil(resto.length / CHARS_PER_TOKEN + tokensEnElPeorCaso(request.directrices!));
    };
    let peor = 0;
    for (const caracter of ['和', 'ꀀ', '🎸']) {
      const directrices = recortarALetras(
        caracter.repeat(MAX_DIRECTRICES_LENGTH),
        MAX_DIRECTRICES_LENGTH,
      );
      for (const mode of ['major', 'minor'] as const) {
        for (const kind of ['continuar', 'retocar'] as const) {
          // Las canciones que más llenan el menú, como en la primera prueba.
          const largas = canciones(mode, 60)
            .map((progression): VersionsRequest => ({
              key: { tonic: 'C', mode },
              kind,
              progression: kind === 'continuar' ? progression.slice(0, 26) : progression,
              role: PAPEL.id,
              estilo: ESTILO,
              pulsosPorCompas: 6,
              directrices,
            }))
            .map((request) => ({ request, largo: enElPeorAlfabeto(request) }))
            .sort((a, b) => b.largo - a.largo)
            .slice(0, 3);
          for (const { largo } of largas) {
            peor = Math.max(peor, largo);
          }
        }
      }
    }

    console.log(
      `peor prompt de salidas en otro alfabeto: ${peor} tokens de ${TOKEN_BUDGETS.versiones.input}`,
    );
    expect(peor).toBeLessThanOrEqual(CABE);
  });

  /**
   * **Y con el resto en su peor caso, el menú no se queda en nada.** Treinta y dos
   * compases del cifrado más largo con punteo, el papel más largo, el estilo, el
   * compás y las directrices enteras, en las veinticuatro tonalidades: el prompt no
   * pasa de su tope y siguen cabiendo tres salidas, que son las que se piden.
   */
  it(
    'con el resto en su peor caso, el prompt no pasa de su tope y caben tres salidas',
    { timeout: 60_000 },
    () => {
      let mayor = 0;
      let fijo = 0;
      for (const mode of ['major', 'minor'] as const) {
        for (const tonic of SHARP_NAMES as readonly NoteName[]) {
          const progression = laMasLarga(tonic, mode);
          for (const kind of ['continuar', 'retocar'] as const) {
            const request: VersionsRequest = {
              key: { tonic, mode },
              kind,
              // Al continuar, el de veintiséis, como arriba.
              progression: kind === 'continuar' ? progression.slice(0, 26) : progression,
              role: PAPEL.id,
              estilo: ESTILO,
              pulsosPorCompas: 6,
              directrices: 'x'.repeat(MAX_DIRECTRICES_LENGTH),
            };
            const cabecera = [lineaDeTonalidad(request.key)];
            const menu = menuDelPrompt(request, cabecera);
            // Una canción así puede no tener ninguna salida que encaje: lo que se mide
            // es que el sitio no falte, no lo que opine el juez.
            const texto = promptDeSalidas(request, cabecera);
            // Lo que se le enseña es todo lo que hay, o tres como poco.
            expect(menu.length).toBeGreaterThanOrEqual(Math.min(3, salidasDe(request).length));
            mayor = Math.max(mayor, texto.length);
            // Lo que no es el menú, con sus saltos: el sitio que ya está ocupado.
            const resto = texto.split('\n').filter((linea) => !/^\d+\. /u.test(linea));
            fijo = Math.max(fijo, resto.join('\n').length + 1);
          }
        }
      }

      // Una salida sin motivos ocupa como mucho su número, su camino, los
      // doscientos caracteres de lo que hace (lo vigila `paths.test.ts`) y todos sus
      // colores. Tres así tienen que caber en lo que deja el peor resto: una canción
      // rara puede tener menos salidas, pero el sitio no puede faltar. **El nombre
      // del movimiento va dentro de lo que hace** —«Cambia V por V/vi en el 2 (su
      // dominante delante)»—, así que uno nuevo más largo no alarga la línea: el
      // dominio la corta a doscientos y suelta antes el porqué del movimiento.
      const camino = Math.max(...PATHS.map((path) => path.id.length));
      const salida =
        `${MAX_OPCIONES_DEL_MENU}. `.length +
        camino +
        2 +
        200 +
        1 +
        `[${Object.values(COLORES).join(', ')}]`.length;
      console.log(
        `peor caso del resto: ${fijo} caracteres; con tres salidas sin motivos, ${fijo + 3 * (salida + 1)} de ${MAX_CARACTERES_DEL_PROMPT}`,
      );
      expect(mayor).toBeLessThanOrEqual(MAX_CARACTERES_DEL_PROMPT);
      expect(fijo + 3 * (salida + 1)).toBeLessThanOrEqual(MAX_CARACTERES_DEL_PROMPT);
    },
  );
});
