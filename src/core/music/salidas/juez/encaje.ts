/**
 * Si una salida **encaja** en tu canción, y por qué.
 *
 * `songProblem` contesta otra pregunta: si una salida está permitida —que cada
 * salto esté en el grafo, que un `seguir` respete tus compases—. Con eso solo,
 * las salidas eran todas válidas y la mitad no convencía a nadie: lo que acababa
 * en V se cerraba con `V IV I`, el bVII valía lo mismo que el V en un jazz y una
 * canción de cuatro compases salía de siete. Válido no es bueno.
 *
 * Este es el juez de lo segundo, y lo que dice ordena el menú: lo que mejor
 * encaja va arriba, lo que no llega al mínimo solo entra si no hay tres que
 * lleguen (la red de `salidasPosibles`), lo que tiene descarte no entra nunca, y
 * los motivos son hechos que el porqué puede contar sin inventarse nada.
 *
 * **Un descarte es absoluto**: suena mal con cualquier canción al lado. Lo que solo
 * es peor que otra cosa —una coda larga, quitar tu color— es un reparo, que deja
 * la salida por debajo del mínimo y la manda a la red (`Hecho`): así lo relativo
 * nunca deja el menú vacío.
 *
 * **Determinista y puro**, como `salidasPosibles`: el menú se construye dos veces
 * por petición y tiene que salir igual las dos.
 *
 * ## Cómo se juzga
 *
 * Once criterios, cada uno de -1 a 1, que miran **lo que la salida añade o
 * cambia** y no lo que ya era tuyo: si tu blues tiene un `V IV`, eso no es culpa
 * de ninguna salida. Los que dependen del contexto —punteo, estilo, papel— solo
 * cuentan cuando el contexto los trae; sin estilo no se premia ni se castiga
 * ningún idioma, que es lo que promete `ContextoDeSalidas`.
 *
 * Todo se cuenta en compases de verdad, sacados de los pulsos: un `I IV V IV` a
 * dos pulsos son dos compases, no cuatro, y un acorde de ocho pulsos ocupa dos.
 */

import type { KeyMode } from '../../keys';
import { degreesFor } from '../../progressions';
import type { ContextoDeSalidas } from '../contexto';
import { gruposPorPulsos } from '../partir';
import type { CandidataAJuzgar, Criterio, CriterioId, Encaje, PathKind, PathStep } from '../tipos';
import { tonicaDe } from '../tonica';
import { bajo } from './bajo';
import { cadencia, finalDe } from './cadencia';
import { enlace } from './enlace';
import { estilo } from './estilo';
import { bluesAMedias, esBluesDeDoce, forma } from './forma';
import { frase } from './frase';
import {
  acordeEnCompas,
  acordes,
  compasesNuevos,
  modalDe,
  pulsos,
  vampDe,
  type Hecho,
  type Juicio,
} from './juicio';
import { melodia } from './melodia';
import { notasComunes } from './notas-comunes';
import { novedad } from './novedad';
import { papel, SE_REPITEN, VUELTA_QUE_LLEGA } from './papel';
import { cuadraLaToma, ritmoArmonico } from './ritmo-armonico';
import { sintaxis } from './sintaxis';

/**
 * Los puntos mínimos para entrar en el menú.
 *
 * **Cincuenta, que es «no dice nada»**: por debajo una salida tiene más en
 * contra que a favor. Se midió primero con el volcado de las 38 canciones del
 * arreglista, y ese volcado era el mismo con el que se ajustó el juez: una
 * verificación con 48 canciones que el equipo no había visto lo demostró, con un
 * 14 % de salidas mal en lo que el corpus no probaba.
 *
 * **Recalibrado con los dos corpus** (`corpus-de-salidas.ts` y
 * `corpus-de-verificacion.ts`, 1315 salidas de menú): las que un arreglista
 * rechaza ya no se separan por puntos sino **por descarte** —el papel, el modo
 * sin sensible, el punteo— o **por reparo**, que las deja justo debajo de este
 * mínimo —el relleno, la coda larga—, y las 14 que aún se cuelan puntúan entre
 * 55 y 83: son idioma que el juez no puede ver sin estilo (un ii–V en música de
 * cine), no salidas flojas. Lo bueno, en cambio, baja hasta 50: entre 50 y 60 hay
 * 63 salidas que los dos arreglistas aceptan. Subir el mínimo las quitaría sin
 * quitar ninguna mala, así que se queda en cincuenta, y las pendientes de cada
 * criterio con él: lo que se ajustó al corpus del equipo no eran los números,
 * eran las reglas que faltaban.
 */
export const ENCAJE_MINIMO = 50;

/**
 * Lo que pesa cada criterio en los puntos. Suman uno.
 *
 * - **Sintaxis y cadencia, lo que más** (0,15 cada una): son lo que oye
 *   cualquiera. Una dominante que vuelve atrás o un final que no llega a ningún
 *   sitio estropean la salida aunque todo lo demás esté bien.
 * - **Frase, después** (0,12): siete compases se notan aunque no se sepa
 *   contarlos. Pesa algo menos porque es aritmética, no armonía: un cierre
 *   precioso de seis compases sigue siendo un cierre precioso.
 * - **Estilo** (0,10): es lo que separa un bVII de rock de uno en un jazz, pero
 *   solo cuenta cuando hay estilo elegido, y entonces ya tira también de la
 *   sintaxis. Más peso lo contaría dos veces.
 * - **Notas comunes** (0,09) y **melodía** (0,08): deciden una rearmonización y
 *   casi no dicen nada al continuar. Cuando hablan, hablan claro.
 * - **Ritmo armónico** (0,08) y **bajo** (0,07): el bajo va muy pegado a la
 *   sintaxis —V I es quinta abajo y dominante a tónica a la vez—, así que pesa
 *   lo justo para desempatar sin contar lo mismo dos veces.
 * - **Novedad** (0,06), **papel** (0,05) y **forma** (0,05): matizan. La forma
 *   pesa poco porque cuando habla —un blues de doce, un vamp modal— suele hacerlo
 *   con un valor extremo, y la frase ya ha dicho buena parte.
 */
const PESOS: Readonly<Record<CriterioId, number>> = {
  sintaxis: 0.15,
  cadencia: 0.14,
  frase: 0.12,
  'ritmo-armonico': 0.07,
  bajo: 0.06,
  'notas-comunes': 0.09,
  melodia: 0.08,
  estilo: 0.11,
  novedad: 0.06,
  papel: 0.05,
  forma: 0.07,
};

/**
 * Si lo tuyo es un bucle: su papel se repite y **su último acorde lleva a su
 * primero** —`I IV bVI bVII` vuelve a la I por el bVII, `vi V IV V` a la vi por
 * la rota—. Un `iii VI ii V` acaba en un V que pide la I, no su iii: es un
 * turnaround que va hacia fuera, y su V no se juzga contra su principio.
 */
function esUnBucle(j: Juicio): boolean {
  const rol = j.contexto.papel;
  const ultimo = j.original[j.original.length - 1]!;
  const primero = j.original[0]!;
  return (
    (rol === undefined || SE_REPITEN.has(rol)) &&
    ultimo.funcion !== 'tonica' &&
    enlace({ ...j, cancion: [ultimo, primero] }, 1, true).valor >= VUELTA_QUE_LLEGA
  );
}

/**
 * Si lo tuyo es **una frase que llega y se sostiene**: acaba en la tónica, la toca
 * más de un compás y no pasa de una frase —`ii V I I`, `VI VII i i`—. Esa frase se
 * repite, y el compás que sostiene la llegada es el sitio de la vuelta: lo que se
 * ponga ahí —`ii V I vi`— se juzga por cómo vuelve a empezar, igual que un bucle. Un
 * periodo de dos frases que acaba así ha terminado, y ahí no hay vuelta.
 */
function vuelveTrasLlegar(j: Juicio, frase: number): boolean {
  const n = j.original.length;
  const sostiene = n >= 3 && j.original[n - 1]!.funcion === 'tonica';
  return (
    sostiene &&
    j.original[n - 2]!.funcion === 'tonica' &&
    j.original.some((acorde) => acorde.funcion !== 'tonica') &&
    j.largoOriginal <= frase
  );
}

/**
 * De cuántos compases son tus frases.
 *
 * Cuatro, salvo que lo tuyo diga otra cosa **a propósito**: varias frases iguales
 * de largo que no cuadran de cuatro en cuatro y acaban todas en el mismo acorde,
 * como `I IV V | vi IV V`. Eso es una forma, no una frase coja, y cuadrarla a ocho
 * es romperla aunque ocho «cuadre».
 */
function fraseDe(j: Juicio): number {
  const largo = j.largoOriginal;
  if (!Number.isInteger(largo) || largo % 4 === 0) {
    return 4;
  }
  const otra = [3, 5, 6, 7].find((frase) => {
    const veces = largo / frase;
    if (!Number.isInteger(veces) || veces < 2) {
      return false;
    }
    const finales = Array.from(
      { length: veces },
      (_, k) => acordeEnCompas(j, j.original, (k + 1) * frase - 1)!.degree,
    );
    return new Set(finales).size === 1;
  });
  return otra ?? 4;
}

/**
 * Juzga una salida contra tu canción y su contexto.
 *
 * Devuelve los once criterios aunque alguno no diga nada, en el mismo orden
 * siempre, para que quien los cuente no tenga que buscarlos. Los que dependen de
 * un contexto que no ha llegado —punteo, estilo, papel— salen a cero y **no
 * cuentan en los puntos**: no es que encajen a medias, es que no se sabe.
 */
/**
 * Lo tuyo **partido como la salida**, cuando la salida parte una dominante en su ii
 * y ella (`partir.ts`): el compás partido se cuenta como dos mitades del mismo
 * acorde, con su especie, su duda y su punteo en las dos.
 *
 * El juez empareja tus compases con los de la salida por su posición, y un acorde
 * de más desalineaba todo lo que venía detrás: el V de la segunda mitad pasaba a
 * «cambiar» el compás de al lado. Así, la primera mitad es lo que cambia —el ii, por
 * su sitio (`porSuSitio`)— y la segunda sigue siendo tuya.
 */
function partidoComoLaSalida(
  original: readonly PathStep[],
  contexto: ContextoDeSalidas,
  candidata: CandidataAJuzgar,
): { readonly original: readonly PathStep[]; readonly contexto: ContextoDeSalidas } {
  const grupos =
    candidata.path === 'rearmonizar' && candidata.cancion.length > original.length
      ? gruposPorPulsos(original, candidata.cancion)
      : null;
  if (grupos === null) {
    return { original, contexto };
  }
  const doble = <T>(lista: readonly T[]): T[] =>
    grupos.flatMap((grupo, i) => grupo.map(() => lista[i]!));
  const { especies, dudosos, melodia } = contexto;
  return {
    original: grupos.flatMap((grupo, i) =>
      grupo.map((j) => ({ degree: original[i]!.degree, beats: candidata.cancion[j]!.beats })),
    ),
    contexto: {
      ...contexto,
      ...(especies === undefined ? {} : { especies: doble(especies) }),
      ...(dudosos === undefined ? {} : { dudosos: doble(dudosos) }),
      ...(melodia === undefined ? {} : { melodia: doble(melodia) }),
    },
  };
}

export function encaje(
  mode: KeyMode,
  kind: PathKind,
  tuyo: readonly PathStep[],
  contextoTuyo: ContextoDeSalidas,
  candidata: CandidataAJuzgar,
): Encaje {
  const { original, contexto } = partidoComoLaSalida(tuyo, contextoTuyo, candidata);
  const existentes = new Set(degreesFor(mode));
  const pasos = [...original, ...candidata.cancion];
  if (
    original.length === 0 ||
    candidata.cancion.length === 0 ||
    pasos.some((paso) => !existentes.has(paso.degree) || !(paso.beats >= 1))
  ) {
    return { puntos: 0, criterios: [], descarte: 'la canción no se puede juzgar en este modo' };
  }

  const especies = contexto.especies ?? [];
  const tuyos = acordes(mode, original, (_, i) => especies[i] ?? null);
  // Lo que la salida no dice de su especie es lo que ya tenía ese compás, si
  // sigue siendo el mismo grado; lo demás suena como su tríada.
  const cancion = acordes(mode, candidata.cancion, (paso, i) =>
    paso.especie !== undefined
      ? paso.especie
      : original[i]?.degree === paso.degree
        ? (especies[i] ?? null)
        : null,
  );
  // El mismo compás que supone quien construye las salidas: uno que no se puede
  // contar —cero pulsos, medio, cien— es el cuatro por cuatro de siempre.
  const pedido = contexto.pulsosPorCompas;
  const pc =
    pedido !== undefined && Number.isInteger(pedido) && pedido >= 1 && pedido <= 16 ? pedido : 4;
  const base: Juicio = {
    mode,
    kind,
    path: candidata.path,
    tonica: tonicaDe(mode),
    estilo: contexto.estilo,
    contexto,
    pc,
    original: tuyos,
    cancion,
    ...compasesNuevos(kind, original, candidata.cancion),
    largo: pulsos(candidata.cancion) / pc,
    largoOriginal: pulsos(original) / pc,
    modal: modalDe(mode, kind, tuyos, contexto.papel, contexto.estilo),
    vamp: vampDe(tuyos),
    bucle: false,
    frase: 4,
    loQueSeAnade: candidata.loQueSeAnade,
    papelNuevo: candidata.papelNuevo,
  };
  // Lo tuyo es un blues si mide doce compases y tiene su forma: los doce primeros
  // de una canción más larga no hacen de ella un coro, y quien construye las
  // salidas (`esUnBlues`) tampoco la trataría como tal.
  const blues = base.largoOriginal === 12 && esBluesDeDoce(base, tuyos);
  // Los ocho primeros de un blues se cuentan de doce en doce al continuarlos: lo
  // que sigue los completa, y dieciséis compases rompen la forma (`bluesAMedias`).
  const aMedias =
    kind === 'continuar' &&
    bluesAMedias(
      mode,
      (compas) => acordeEnCompas(base, tuyos, compas)?.degree,
      base.largoOriginal,
      contexto,
    );
  // Un blues es un bucle aunque acabe en casa: el 12 lleva al coro siguiente.
  const deFrase = fraseDe(base);
  const j: Juicio = {
    ...base,
    bucle: kind === 'retocar' && (blues || esUnBucle(base) || vuelveTrasLlegar(base, deFrase)),
    frase: deFrase,
  };

  const final = finalDe(j);
  const deMelodia = melodia(j);
  const deEstilo = estilo(j);
  const dePapel = papel(j, final);
  const hechos: Readonly<Record<CriterioId, Hecho>> = {
    sintaxis: sintaxis(j),
    cadencia: cadencia(j, final),
    frase: frase(j, final, blues || aMedias),
    'ritmo-armonico': ritmoArmonico(j),
    bajo: bajo(j),
    'notas-comunes': notasComunes(j),
    melodia: deMelodia,
    estilo: deEstilo,
    novedad: novedad(j, j.vamp !== null, blues),
    papel: dePapel,
    forma: forma(j, final, blues),
  };
  const noAplican = new Set<CriterioId>([
    ...(deMelodia.aplica ? [] : (['melodia'] as const)),
    ...(deEstilo.aplica ? [] : (['estilo'] as const)),
    ...(dePapel.aplica ? [] : (['papel'] as const)),
  ]);

  // Con una toma desigual el ritmo manda el doble: es lo primero que hay que
  // arreglar, y cualquier acorde nuevo encima cae igual de a destiempo.
  const pesos: Readonly<Record<CriterioId, number>> =
    cuadraLaToma(j) === null ? PESOS : { ...PESOS, 'ritmo-armonico': PESOS['ritmo-armonico'] * 2 };
  const ids = Object.keys(PESOS) as CriterioId[];
  const criterios: Criterio[] = ids.map((id) => ({
    id,
    valor: Math.round(hechos[id].valor * 100) / 100,
    motivo: hechos[id].motivo,
  }));
  const cuentan = ids.filter((id) => !noAplican.has(id));
  const peso = cuentan.reduce((suma, id) => suma + pesos[id], 0);
  const suma = cuentan.reduce((total, id) => total + pesos[id] * hechos[id].valor, 0);
  const descarte = ids.map((id) => hechos[id].descarte).find((motivo) => motivo !== undefined);
  // Un reparo no descarta: deja la salida por debajo del mínimo, para la red.
  const reparo = ids.map((id) => hechos[id].reparo).find((motivo) => motivo !== undefined);
  const puntos = Math.round(50 + (50 * suma) / peso);

  return {
    puntos: reparo === undefined ? puntos : Math.min(puntos, ENCAJE_MINIMO - 1),
    criterios,
    descarte: descarte ?? null,
    ...(reparo === undefined ? {} : { reparo }),
  };
}
