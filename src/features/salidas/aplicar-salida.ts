/**
 * Quedarse con una salida: lo que cambia en la canción, y lo que no.
 *
 * **Pisaba la canción entera.** Estrofa, estribillo y puente pasaban a ser «Lo que
 * llevas» y «Cierre»; la séptima de cada bloque, la duda de lo que leyó el micro,
 * el papel, las vueltas y el punteo se perdían, y lo que se había mandado era una
 * sola parte. Quedarse con una idea costaba la canción, y el deshacer era lo único
 * que lo arreglaba.
 *
 * Ahora una salida cambia **solo la parte a la que se refiere**:
 *
 * - **Retocar** cambia los bloques de esa parte. Lo que no cambia de grado ni de
 *   especie se queda como estaba, con su duda y sus alternativas: que una salida
 *   no lo toque no es haberlo confirmado. Lo demás de la parte —nombre, papel,
 *   vueltas, compases y punteo— no se toca.
 * - **Continuar** mete las partes nuevas justo detrás de esa, y las demás siguen
 *   donde estaban.
 *
 * Lo que no estaba en la canción —lo grabado, o el camino de antes del lienzo—
 * entra como partes nuevas al final.
 *
 * TypeScript puro: el montaje entra y sale, y el panel lo pone con `replace`, que
 * es un solo paso del deshacer.
 */

import {
  clampBeats,
  gruposPorPulsos,
  MAX_PARTS,
  writtenBlock,
  type Arrangement,
  type Block,
  type CapturedStep,
  type Part,
  type PathId,
} from '@core/music';

import type { SalidaPropuesta, SalidaSection, SalidaStepOut } from './contract';

/** De dónde salieron los compases que se mandaron. */
export type FuenteDeLasSalidas =
  /** Una parte de la canción, por su identificador. */
  | { readonly tipo: 'parte'; readonly partId: string }
  /** Lo grabado, tal como se mandó: con su duda y sus alternativas. */
  | { readonly tipo: 'grabado'; readonly pasos: readonly CapturedStep[] }
  /** El camino de antes del lienzo, que no tiene ni partes ni dudas. */
  | { readonly tipo: 'camino' };

export interface SalidaAplicada {
  readonly montaje: Arrangement;
  /**
   * Si la parte tiene punteo y debajo han cambiado acordes o duraciones.
   *
   * **El punteo no se borra**: es trabajo, y una nota que ya no cae en el acorde
   * puede ser justo la tensión que alguien quería. Pero tampoco se calla, porque
   * nadie lo ha oído con los acordes nuevos.
   */
  readonly punteoSinRevisar: boolean;
}

interface Opciones {
  /** Para medir los compases de una parte nueva. */
  readonly pulsosPorCompas: number;
  /** Los identificadores los pone la capa de estado: aquí no hay azar. */
  readonly nuevoId: (prefijo: string) => string;
}

/**
 * Si lo que había sigue siendo lo que propone ese compás: mismo grado y misma
 * especie. Lo grabado no trae especie, así que es la tríada.
 */
function sigueIgual(antes: Pick<Block, 'degree' | 'especie'>, paso: SalidaStepOut): boolean {
  return paso.from !== null && antes.degree === paso.degree && antes.especie === paso.especie;
}

/**
 * Lo que había en el sitio de cada compás de la salida: por posición, o **por
 * pulsos** si la salida parte una dominante en su ii y ella (`gruposPorPulsos`).
 * Las dos mitades vienen del mismo, y la que sigue siendo él se lo queda.
 *
 * **Lo usan la parte y lo grabado**, y por eso es uno: lo grabado se seguía
 * emparejando por posición, y detrás del partido cada compás se comparaba con el de
 * al lado. `I V I` con el último dudoso, retocado a `I ii V I`, entraba con el `V`
 * escrito y la `I` escrita con confianza uno: la duda confirmada sin que nadie la
 * mirase.
 *
 * Los pulsos de lo que había se miran como los vio el servidor, redondeados y con
 * su tope (`clampBeats`): lo grabado viaja tal cual, y la salida vuelve con lo que
 * se leyó.
 */
function deDondeViene<T extends { readonly beats: number }>(
  origen: readonly T[],
  pasos: readonly SalidaStepOut[],
  path: PathId,
): readonly (T | undefined)[] {
  const grupos =
    path === 'rearmonizar' && pasos.length !== origen.length
      ? gruposPorPulsos(
          origen.map((antes) => ({ beats: clampBeats(antes.beats) })),
          pasos,
        )
      : null;
  return grupos === null
    ? pasos.map((_, i) => origen[i])
    : grupos.flatMap((grupo, i) => grupo.map(() => origen[i]));
}

function escrito(paso: SalidaStepOut, { nuevoId }: Opciones): Block {
  return writtenBlock(nuevoId('bloque'), paso.degree, paso.beats, paso.especie);
}

function parteNueva(name: string, blocks: readonly Block[], opciones: Opciones): Part {
  const pulsos = blocks.reduce((total, block) => total + block.beats, 0);
  return {
    id: opciones.nuevoId('parte'),
    name,
    blocks,
    notes: [],
    // Los compases que ocupa y ninguno más: con los cuatro de una parte vacía, un
    // cierre de dos compases dejaba otros dos de papel en blanco detrás.
    bars: Math.max(1, Math.ceil(pulsos / Math.max(1, opciones.pulsosPorCompas))),
  };
}

/**
 * Los bloques de lo que se mandó desde fuera de la canción.
 *
 * Lo grabado que la salida no cambia entra **oído**, con la duda que traía: es lo
 * que permite al lienzo seguir preguntando por él. Se empareja igual que una parte
 * (`deDondeViene`), así que de una dominante partida la mitad que sigue siendo ella
 * entra oída, con lo que dura ahora. Lo que cambia, y todo lo del camino, entra
 * escrito.
 */
function bloquesDeFuera(
  pasos: readonly SalidaStepOut[],
  fuente: FuenteDeLasSalidas,
  path: PathId,
  opciones: Opciones,
): Block[] {
  const oidos = fuente.tipo === 'grabado' ? deDondeViene(fuente.pasos, pasos, path) : [];
  return pasos.map((paso, i) => {
    const oido = oidos[i];
    if (oido !== undefined && sigueIgual(oido, paso)) {
      return {
        id: opciones.nuevoId('bloque'),
        degree: paso.degree,
        beats: clampBeats(paso.beats),
        source: 'heard',
        confidence: oido.confidence,
        alternatives: oido.alternatives,
      };
    }
    return escrito(paso, opciones);
  });
}

/** Las partes que no son tuyas, que es lo que añade una salida que continúa. */
function partesNuevas(secciones: readonly SalidaSection[], opciones: Opciones): Part[] {
  return secciones
    .filter((seccion) => !seccion.yours)
    .map((seccion) =>
      parteNueva(
        seccion.name,
        seccion.steps.map((paso) => escrito(paso, opciones)),
        opciones,
      ),
    );
}

/**
 * La canción con esa salida puesta, o nulo si no caben las partes que añade.
 *
 * Nulo y no recortada: quedarse con media salida sería quedarse con otra cosa.
 */
export function aplicarSalida(
  montaje: Arrangement,
  propuesta: SalidaPropuesta,
  fuente: FuenteDeLasSalidas,
  opciones: Opciones,
): SalidaAplicada | null {
  // Una salida que continúa trae lo tuyo delante, marcado; una que retoca, no.
  const continua = propuesta.sections.some((seccion) => seccion.yours);
  const indice =
    fuente.tipo === 'parte' ? montaje.parts.findIndex((part) => part.id === fuente.partId) : -1;

  // Desde fuera de la canción —o si la parte se ha borrado mientras tanto— todo
  // entra al final: lo tuyo y lo nuevo al continuar, lo retocado al retocar.
  if (indice === -1) {
    const partes = continua
      ? propuesta.sections.map((seccion) =>
          seccion.yours
            ? parteNueva(
                seccion.name,
                bloquesDeFuera(seccion.steps, fuente, propuesta.path, opciones),
                opciones,
              )
            : parteNueva(
                seccion.name,
                seccion.steps.map((paso) => escrito(paso, opciones)),
                opciones,
              ),
        )
      : [
          parteNueva(
            /* v8 ignore next -- una salida validada trae siempre su parte */
            propuesta.sections[0]?.name ?? 'Lo que llevas',
            bloquesDeFuera(propuesta.steps, fuente, propuesta.path, opciones),
            opciones,
          ),
        ];
    if (montaje.parts.length + partes.length > MAX_PARTS) {
      return null;
    }
    return { montaje: { parts: [...montaje.parts, ...partes] }, punteoSinRevisar: false };
  }

  const parte = montaje.parts[indice]!;

  if (continua) {
    const nuevas = partesNuevas(propuesta.sections, opciones);
    if (montaje.parts.length + nuevas.length > MAX_PARTS) {
      return null;
    }
    return {
      montaje: {
        parts: [
          ...montaje.parts.slice(0, indice + 1),
          ...nuevas,
          ...montaje.parts.slice(indice + 1),
        ],
      },
      punteoSinRevisar: false,
    };
  }

  // Retocar: compás a compás contra lo que hay, por pulsos si la salida parte una
  // dominante (`deDondeViene`). Lo que sigue igual se queda con su identificador, su
  // duda y sus alternativas; si solo cambia lo que dura, se estira el mismo bloque.
  const deDonde = deDondeViene(parte.blocks, propuesta.steps, propuesta.path);
  const blocks = propuesta.steps.map((paso, i) => {
    const antes = deDonde[i];
    if (antes !== undefined && sigueIgual(antes, paso)) {
      return paso.beats === antes.beats ? antes : { ...antes, beats: clampBeats(paso.beats) };
    }
    return escrito(paso, opciones);
  });
  const cambia =
    blocks.length !== parte.blocks.length || blocks.some((block, i) => block !== parte.blocks[i]);

  return {
    montaje: {
      parts: montaje.parts.map((part, i) => (i === indice ? { ...part, blocks } : part)),
    },
    punteoSinRevisar: cambia && parte.notes.length > 0,
  };
}
