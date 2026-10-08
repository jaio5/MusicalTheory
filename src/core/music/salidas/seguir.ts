/**
 * El camino `seguir`: lo tuyo tal cual y lo que va detrás.
 *
 * Cerrar en la tónica, una segunda vuelta, completar la forma que dejas a medias.
 * Los coros de un blues van aparte (`coros.ts`), y la parte que contrasta en
 * `contraste.ts`.
 */
import type { EspecieDeBloque } from '../chords';
import { roleOfDegreeSymbol } from '../harmonic-function';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import {
  CIERRE,
  comoLlega,
  conArticulo,
  CONSECUENTE,
  empiezaPor,
  laQueQuepa,
  LARGO_MAXIMO_DE_LO_QUE_HACE,
  LARGO_MAXIMO_DEL_NOMBRE,
  largosQueCuadran,
  LO_QUE_CIERRA,
  nuevos,
  otraVez,
  OTRO_ESTRIBILLO,
  prioridadDe,
  repartir,
  ULTIMA_VUELTA,
  type Borrador,
} from './borrador';
import { cierresDesde, type CaminoValorado } from './busqueda';
import { completarElBlues, coros, esUnBluesAMedias, llegadaDelBlues } from './coros';
import { especieNueva, paso, tuyo } from './especies';
import { compasesDe, formasDe, pasosDelTramo, type LoQueFalta } from './formas';
import { LARGO_DE_UNA_FRASE, type Idioma } from './idioma';
import { esUnaBajada } from './juez/notas-comunes';
import type { ParteDeSalida, PathStep } from './tipos';
import { canFollow, MAX_PATH_STEPS, pulsosDe, saltosDe } from './validar';
import { deDominantes, valorDeCierre } from './valor';

/**
 * Si llegar a la tónica desde ese acorde es **resolver**: si es una dominante suya
 * —el V, el vii°, las que llegan sin sensible— o el bII con séptima, que es su
 * sustituto. Desde un ii o un IV se llega, pero no se resuelve nada: no había
 * tensión que deshacer.
 */
function esDominanteDeLaTonica(degree: DegreeSymbol, especie: EspecieDeBloque | null): boolean {
  return roleOfDegreeSymbol(degree) === 'dominant' || (degree === 'bII' && especie === 'dominant7');
}

/**
 * Por dónde sigue una línea de bajo que baja, o nulo si lo tuyo no acaba en una.
 *
 * `I iii bIII ii` es una bajada cromática —Mi, Mib, Re— que va hacia la dominante:
 * el ii pide el V, o el bII7 que sigue bajando. Volver de ahí a la I se salta
 * adonde iba la línea, y era la segunda salida del menú. Se reconoce por la forma
 * —los tres últimos acordes, cada uno a uno o dos semitonos por debajo del
 * anterior— y solo si la línea no ha llegado ya: si acaba en una dominante o en
 * casa, lo que sigue es lo de siempre. Lo que puede ir detrás es una dominante de
 * la tónica o un acorde que siga bajando por grados, y la tónica no: es justo lo
 * que la línea todavía no ha preparado.
 */
function siguenLaLinea(id: Idioma, original: readonly PathStep[]): DegreeSymbol[] | null {
  const ultimo = original.at(-1)!.degree;
  if (
    original.length < 3 ||
    ultimo === id.tonica ||
    esDominanteDeLaTonica(ultimo, id.especies.at(-1) ?? null)
  ) {
    return null;
  }
  const raiz = (degree: DegreeSymbol) => resolveDegree(0, id.mode, degree).root;
  const baja = (de: DegreeSymbol, a: DegreeSymbol) =>
    [1, 2].includes((raiz(de) - raiz(a) + 12) % 12);
  const cola = original.slice(-3).map((paso) => paso.degree);
  if (!baja(cola[0]!, cola[1]!) || !baja(cola[1]!, cola[2]!)) {
    return null;
  }
  return saltosDe(id.mode, ultimo)
    .map((move) => move.to)
    .filter(
      (grado) =>
        grado !== id.tonica &&
        (esDominanteDeLaTonica(grado, especieNueva(id, grado, null)) || baja(ultimo, grado)),
    );
}

/**
 * Por dónde empieza lo que sigue, o nulo si por cualquiera. Lo pide, por este
 * orden:
 *
 * 1. **El papel de la parte nueva**: una estrofa empieza en casa, un estribillo
 *    donde empiezan (`empiezaPor`).
 * 2. **Una línea de bajo que no ha llegado** (`siguenLaLinea`).
 * 3. **Un V que acaba lo tuyo**: pide la tónica ya, o el sexto grado que la
 *    engaña. Un puente que arrancaba del V7 hacia el III7 o el iii dejaba la
 *    dominante colgando, y es lo primero que se oye. En un blues o un funk no:
 *    allí `V IV` es el idioma.
 *
 * Cada uno estrecha lo de antes si deja algo; si lo dejaría vacío, manda lo de
 * antes. Una estrofa que sigue a un V empieza en casa, que es las dos cosas.
 */
export function primerosDeLoQueSigue(
  id: Idioma,
  original: readonly PathStep[],
  porElPapel: readonly DegreeSymbol[] | null,
): readonly DegreeSymbol[] | null {
  const linea = siguenLaLinea(id, original);
  const sexto: DegreeSymbol = id.mode === 'major' ? 'vi' : 'VI';
  // Detrás de una canción que baja entera por grados hasta el V —la andaluza—, la
  // rota no cabe: el VI es el escalón de antes, y volver a él deshace la bajada que
  // es la canción (`esUnaBajada`). Lo que sigue a esa llegada es la tónica.
  const bajada = esUnaBajada(
    id.mode,
    original.map((paso) => paso.degree),
  );
  const resuelveElV =
    original.at(-1)!.degree === 'V' && !deDominantes(id)
      ? [id.tonica, ...(bajada && original.at(-2)!.degree === sexto ? [] : [sexto])]
      : null;
  let elegidos: readonly DegreeSymbol[] | null = null;
  for (const pedidos of [porElPapel, linea, resuelveElV]) {
    if (pedidos === null || pedidos.length === 0) {
      continue;
    }
    const ambos: readonly DegreeSymbol[] =
      elegidos === null ? pedidos : elegidos.filter((g) => pedidos.includes(g));
    elegidos = ambos.length > 0 ? ambos : elegidos;
  }
  return elegidos;
}

/** Lo que mira cada manera de seguir lo tuyo: cómo acaba y cómo se dice llegar. */
interface LoQueSigue {
  readonly id: Idioma;
  readonly original: readonly PathStep[];
  readonly ultimo: DegreeSymbol;
  readonly antes: DegreeSymbol | null;
  readonly dudaElUltimo: boolean;
  /** «Resuelve en la I» si de verdad resuelve; «Vuelve a la I» si no. */
  readonly aLaTonica: string;
  /** Lo que se premia cerrar: al final de la canción y después de un puente. */
  readonly ajuste: number;
}

function loQueSigueDe(id: Idioma, original: readonly PathStep[]): LoQueSigue {
  const ultimo = original.at(-1)!.degree;
  const dudaElUltimo = id.dudosos[original.length - 1] === true;
  return {
    id,
    original,
    ultimo,
    antes: original.at(-2)?.degree ?? null,
    dudaElUltimo,
    // Llegar a la tónica solo es resolver si lo tuyo acaba en una dominante suya, **y
    // si se sabe que acaba en ella**: lo que el micro oyó con duda no resuelve nada.
    aLaTonica:
      !dudaElUltimo && esDominanteDeLaTonica(ultimo, id.especies.at(-1) ?? null)
        ? `Resuelve en la ${id.tonica}`
        : `Vuelve a la ${id.tonica}`,
    // Una salida que cierra se premia al final de la canción y después de un puente.
    ajuste: (id.papel === 'final' ? 1 : 0) + (id.papel === 'puente' ? 0.5 : 0),
  };
}

function borradorDeSeguir(
  s: LoQueSigue,
  partes: ParteDeSalida[],
  valor: number,
  familia: string,
  nombre: string,
  que: string,
): Borrador {
  return {
    path: 'seguir',
    partes,
    nombre,
    que,
    prioridad: prioridadDe(valor + s.ajuste),
    familia,
    // Lo que se llama cierre completa lo tuyo; lo demás es la parte que sigue.
    loQueSeAnade:
      partes[0]!.name === CIERRE.nombre || partes[0]!.name === CONSECUENTE.nombre
        ? 'tuya'
        : partes[0]!.name === OTRO_ESTRIBILLO.nombre
          ? 'misma'
          : 'otra',
  };
}

/**
 * La llegada: si para cuadrar la frase falta un compás, la tónica en ese
 * compás. Es lo que pide una dominante, y no se podía: la parte más corta
 * medía dos compases. **Un compás, no más**: cuadrar estirando un acorde
 * —una I de cuatro compases detrás de un V— es relleno, no música. Y con un
 * compás de sitio no hay línea de bajo que continuar (`siguenLaLinea`): la
 * llegada es lo único que cabe.
 */
function laLlegada(s: LoQueSigue, pulsos: number, añadir: number): Borrador | null {
  const { id, original, ultimo, antes } = s;
  const tonica = id.tonica;
  // Si tu último compás se oyó con duda, la llegada de un compás descansa entera
  // en él: si el micro se equivocó, no cierra. Mejor una frase que traiga su
  // propia cadencia (lo pidió el corpus final).
  if (s.dudaElUltimo || ultimo === tonica || !canFollow(id.mode, ultimo, tonica)) {
    return null;
  }
  const especie = especieNueva(id, tonica, null);
  return borradorDeSeguir(
    s,
    [
      {
        name: CIERRE.nombre,
        yours: false,
        steps: [paso(tonica, pulsos, null, especie)],
      },
    ],
    valorDeCierre(id, antes, ultimo, [tonica]),
    'resuelve',
    s.aLaTonica,
    `Añade la llegada: de tu ${ultimo} a la ${tonica}, ${comoLlega(id, ultimo, id.especies.at(-1) ?? null)}${(pulsosDe(original) + añadir) % id.frase === 0 ? ', y la frase cuadra' : ''}.`,
  );
}

/**
 * Una frase que cuadra, compás a compás y al ritmo de lo tuyo: la que resuelve
 * ya y sigue hasta cerrar, la que prepara la llegada con un ii–V, la plagal…
 * `cierresDesde` reparte las mejores por cómo llegan.
 */
function frasesQueCierran(s: LoQueSigue, reparto: readonly number[]): Borrador[] {
  const { id, original, ultimo, antes } = s;
  const tonica = id.tonica;
  // Si la parte va a llamarse estrofa o estribillo pase lo que pase, empieza como
  // empiezan; si no, el nombre ya lo decide por dónde empieza (abajo).
  const empieza = primerosDeLoQueSigue(
    id,
    original,
    ultimo === tonica || reparto.length > LARGO_DE_UNA_FRASE
      ? empiezaPor(id, LO_QUE_CIERRA[id.papel], ultimo)
      : null,
  );
  return cierresDesde(id, antes, ultimo, reparto.length, 4, empieza).map((cierre) => {
    const steps = nuevos(id, cierre.grados, reparto);
    const penultimo = [ultimo, ...cierre.grados].at(-2)!;
    const grados = cierre.grados.join(' ');
    const resuelve = ultimo !== tonica && cierre.grados[0] === tonica;
    // Si completa el periodo de lo tuyo —tu cabeza otra vez y en casa—, es su
    // consecuente, y se llama así: el juez lo cuenta como un periodo, y el nombre
    // no puede decir «estribillo» mientras el motivo dice otra cosa.
    const nombreDeLaParte = completaElPeriodo(id, original, steps)
      ? CONSECUENTE
      : ultimo === tonica || resuelve || reparto.length > LARGO_DE_UNA_FRASE
        ? (otraVez(id, steps) ?? LO_QUE_CIERRA[id.papel])
        : CIERRE;
    // Una frase larga va en dos partes: lo que se va y el cierre que vuelve.
    const corte =
      steps.length > LARGO_DE_UNA_FRASE ? steps.length - (steps.length >= 8 ? 4 : 2) : 0;
    const partes: ParteDeSalida[] =
      corte === 0
        ? [{ name: nombreDeLaParte.nombre, yours: false, steps }]
        : [
            { name: nombreDeLaParte.nombre, yours: false, steps: steps.slice(0, corte) },
            { name: CIERRE.nombre, yours: false, steps: steps.slice(corte) },
          ];
    const como = comoLlega(id, penultimo, steps.at(-2)?.especie ?? null);
    const comienzo = resuelve ? `${s.aLaTonica} y añade ` : 'Añade ';
    const esConsecuente = nombreDeLaParte === CONSECUENTE;
    return borradorDeSeguir(
      s,
      partes,
      // Lo que completa la forma va por delante de lo que la deja abierta.
      cierre.valor - (resuelve && s.dudaElUltimo ? 0.5 : 0) + (esConsecuente ? 1 : 0),
      `${resuelve ? 'resuelve' : 'cierre'}:${penultimo}`,
      laQueQuepa(
        LARGO_MAXIMO_DEL_NOMBRE,
        `${nombreDeLaParte.nombre}: ${grados}`,
        `${nombreDeLaParte.nombre} de ${steps.length} acordes`,
      ),
      esConsecuente
        ? laQueQuepa(
            LARGO_MAXIMO_DE_LO_QUE_HACE,
            `Añade el consecuente, ${grados}: tu misma cabeza, y llega a la tónica ${como}. Un periodo entero.`,
            `Añade el consecuente: tu misma cabeza, y llega a la tónica ${como}. Un periodo entero.`,
          )
        : laQueQuepa(
            LARGO_MAXIMO_DE_LO_QUE_HACE,
            `${comienzo}${conArticulo(nombreDeLaParte)}, ${grados}, que llega a la tónica ${como}.`,
            `${comienzo}${conArticulo(nombreDeLaParte)} de ${steps.length} acordes que llega a la tónica ${como}.`,
          ),
    );
  });
}

/**
 * Seguir: resolver ya, una segunda vuelta que cierra, un cierre que completa la
 * frase y, si lo tuyo es un blues, otro coro.
 */
export function continuaciones(id: Idioma, original: readonly PathStep[]): Borrador[] {
  if (id.blues) {
    return [...llegadaDelBlues(id, original), ...coros(id, original)];
  }
  if (esUnBluesAMedias(id, original)) {
    return completarElBlues(id, original);
  }
  // Un vaivén modal que no gira en la tónica no se cierra en ella: `ii V ii V` en
  // Do es Re dórico, y acabarlo en Do se carga el modo. Lo que le sigue es irse y
  // volver, que son los contrastes.
  if (id.centroModal !== null) {
    return [];
  }
  const s = loQueSigueDe(id, original);
  // El vamp va delante: si una cadencia construye lo mismo, el nombre que vale es
  // el de ir al IV y volver.
  const borradores: Borrador[] = [...alCuartoYVuelta(id, original)];
  for (const añadir of largosQueCuadran(id, original)) {
    // Sin tope de acordes: el de compases ya lo pone `largosQueCuadran`, dos frases
    // como mucho. Contarlo en acordes dejaba sin frase nueva todo lo que va a dos
    // pulsos —una frase son ocho acordes, y completar la tuya y añadir otra, diez—,
    // y una canción larga a dos pulsos se quedaba con un solo cierre posible.
    const reparto = repartir(id, original, añadir, true);
    if (reparto === null) {
      continue;
    }
    if (reparto.length === 1) {
      const llegada = laLlegada(s, reparto[0]!, añadir);
      borradores.push(...(llegada === null ? [] : [llegada]));
    } else {
      borradores.push(...frasesQueCierran(s, reparto));
    }
  }
  const segunda = segundaVuelta(id, original);
  if (segunda !== null) {
    borradores.push({ ...segunda, prioridad: segunda.prioridad + 2 * s.ajuste });
  }
  return borradores;
}

/**
 * Lo que sigue a un vamp de un acorde: el mismo vamp en la subdominante y vuelta a
 * casa, `IV7 IV7 I7 I7` detrás de cuatro de I7.
 *
 * Es lo que hace cualquiera con un funk, un soul o un blues que se queda en un
 * acorde: el segundo bloque se va un cuarto arriba y vuelve, y la forma es la del
 * blues. Las cadencias no lo encontraban —desde la tónica sola el camino mejor
 * valorado es una frase que pasa por todo—, y lo que salía era un ii–V–I de
 * manual pegado a un vamp. Con la mitad de lo nuevo en el IV y la otra mitad en
 * casa, al paso de lo tuyo.
 */
function alCuartoYVuelta(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const tonica = id.tonica;
  if (original.length < 2 || original.some((paso) => paso.degree !== tonica)) {
    return [];
  }
  const cuarto: DegreeSymbol = id.mode === 'major' ? 'IV' : 'iv';
  const [añadir] = largosQueCuadran(id, original);
  const reparto = repartir(id, original, añadir!);
  // Con la canción casi en el tope no cabe ir y volver.
  if (reparto === null || reparto.length < 2) {
    return [];
  }
  const fuera = Math.ceil(reparto.length / 2);
  const grados = reparto.map((_, k) => (k < fuera ? cuarto : tonica));
  const dicho = grados.join(' ');
  return [
    {
      path: 'seguir',
      partes: [
        { name: LO_QUE_CIERRA[id.papel].nombre, yours: false, steps: nuevos(id, grados, reparto) },
      ],
      nombre: `Al ${cuarto} y vuelta: ${dicho}`,
      que: `Añade ${conArticulo(LO_QUE_CIERRA[id.papel])}, ${dicho}: tu vamp se va a la subdominante, ${cuarto}, y vuelve a casa, como el segundo bloque de un blues.`,
      prioridad: prioridadDe(2.5),
      familia: 'vamp',
      loQueSeAnade: 'otra',
    },
  ];
}

/**
 * La segunda vuelta: tu frase otra vez, con el final cambiado para que cierre.
 *
 * Es el periodo de toda la vida —antecedente que se queda abierto, consecuente
 * que cierra— y es lo primero que propone cualquiera ante cuatro compases que
 * acaban en V. Cambia lo menos posible: el último compás, o los dos o tres
 * últimos si así llega mejor.
 */
function segundaVuelta(id: Idioma, original: readonly PathStep[]): Borrador | null {
  const largo = original.length;
  const ultimo = original.at(-1)!.degree;
  const total = pulsosDe(original);
  // Volver a empezar es lo que sigue a tu último compás, y una línea de bajo que no
  // ha llegado no vuelve al principio (`siguenLaLinea`).
  const linea = siguenLaLinea(id, original);
  if (
    // Lo que sigue a un pre o a un puente es el estribillo, no otra vez el pre: su
    // segunda vuelta volvía del V al ii (corpus final).
    id.papel === 'pre' ||
    id.papel === 'puente' ||
    (linea !== null && !linea.includes(original[0]!.degree)) ||
    ultimo === id.tonica ||
    (total % id.frase !== 0 && (largo * id.pulsos) % id.frase !== 0) ||
    total > 2 * id.frase ||
    largo * 2 > MAX_PATH_STEPS ||
    !canFollow(id.mode, ultimo, original[0]!.degree)
  ) {
    return null;
  }
  let mejor: { k: number; cierre: CaminoValorado; valor: number } | null = null;
  // Como mucho la mitad: cambiar tres compases de cuatro ya no es repetir tu frase.
  // Y lo que se repite no puede ser algo que el micro oyó con duda: tocarlo otra vez
  // es construir encima como si fuera seguro (el arreglista lo tachó en `I iii? vi
  // IV`). Lo que se cambia sí puede serlo: la segunda vuelta lo deja atrás.
  for (let k = 1; k <= Math.min(3, Math.floor(largo / 2)); k += 1) {
    if (id.dudosos.slice(0, largo - k).some((duda) => duda)) {
      continue;
    }
    const desde = original[largo - k - 1]!.degree;
    const antes = original[largo - k - 2]?.degree ?? null;
    const [cierre] = cierresDesde(id, antes, desde, k, 1);
    const valor = cierre === undefined ? -Infinity : cierre.valor - 0.3 * (k - 1);
    if (cierre !== undefined && (mejor === null || valor > mejor.valor)) {
      mejor = { k, cierre, valor };
    }
  }
  // Sin una manera de repetir que no copie lo dudoso, no hay segunda vuelta. Con un
  // compás que se puede tocar dos veces siempre hay un camino a casa en tres pasos:
  // lo vigila la prueba de todos los grados.
  if (mejor === null) {
    return null;
  }
  const { k, cierre } = mejor;
  // A los pulsos habituales: repetir una toma desigual copiaría su accidente.
  const copiados = original
    .slice(0, largo - k)
    .map((_, i) => ({ ...tuyo(id, original, i), beats: id.pulsos }));
  const cambiados = cierre.grados.map((degree) =>
    paso(degree, id.pulsos, null, especieNueva(id, degree, null)),
  );
  const penultimo = [original[largo - k - 1]!.degree, ...cierre.grados].at(-2)!;
  return {
    path: 'seguir',
    partes: [{ name: 'Segunda vuelta', yours: false, steps: [...copiados, ...cambiados] }],
    loQueSeAnade: 'misma',
    nombre: 'Segunda vuelta que cierra',
    que: laQueQuepa(
      LARGO_MAXIMO_DE_LO_QUE_HACE,
      `Repite tu frase y la cierra: los últimos ${k === 1 ? 'compás pasa' : `${k} compases pasan`} a ${cierre.grados.join(' ')}, que llega a la tónica ${comoLlega(id, penultimo, cambiados.at(-2)?.especie ?? null)}.`,
      `Repite tu frase y la cierra en la tónica, ${comoLlega(id, penultimo, null)}.`,
    ).replace('los últimos compás pasa', 'el último compás pasa'),
    prioridad: prioridadDe(mejor.valor + 0.3),
    familia: 'segunda-vuelta',
  };
}

/**
 * Lo que sigue a lo tuyo: las que cierran y las que contrastan.
 *
 * **Una entrada no se continúa cerrando**: lo que viene detrás es la estrofa, que
 * sale de ella y no la termina, y cerrar ahí es tratarla como una canción acabada.
 * Solo si no hay ninguna parte que se vaya y vuelva —una entrada que empieza en un
 * acorde al que no vuelve nadie— queda cerrar, antes que no ofrecer nada.
 *
 * **Y al revés con lo que lleva a una llegada**: detrás de un pre viene el
 * estribillo, detrás de un puente la vuelta a casa y detrás de un final, la coda.
 * Otra parte que se va y vuelve al principio de la tuya es contestar a un pre con
 * otro pre: el arreglista la tachaba arriba del menú, y el juez solo la bajaba un
 * punto. Si los cierres no dan para elegir —tres—, queda contrastar antes que dejar
 * el menú sin nada.
 */
/**
 * Lo que le falta a la forma de lo tuyo (`formasDe`, la misma vara que el juez), si
 * se reconoce en compases enteros y es eso lo que falta.
 */
export function faltaALaForma(
  id: Idioma,
  original: readonly PathStep[],
  que: LoQueFalta['que'],
): LoQueFalta | null {
  const compases = compasesDe(original, id.compas);
  const formas = compases === null ? [] : formasDe(id.mode, compases);
  return formas.find((forma) => forma.falta?.que === que)?.falta ?? null;
}

/**
 * Si lo que se añade **es el consecuente que le falta a lo tuyo** (`formasDe`): mide
 * lo que falta, empieza repitiendo tu cabeza compás a compás y acaba en la tónica.
 * Detrás de un pre o de un puente no: lo que viene es el estribillo, otra parte, y
 * cerrar ahí sería quitarle la llegada.
 */
function completaElPeriodo(
  id: Idioma,
  original: readonly PathStep[],
  nuevos: readonly PathStep[],
): boolean {
  const falta = faltaALaForma(id, original, 'consecuente');
  if (falta === null || id.papel === 'pre' || id.papel === 'puente') {
    return false;
  }
  const cabeza = pasosDelTramo(original, id.compas, falta.repite!);
  return (
    cabeza !== null &&
    pulsosDe(nuevos) === falta.compases * id.compas &&
    nuevos.at(-1)!.degree === id.tonica &&
    cabeza.every((paso, i) => nuevos[i]?.degree === paso.degree && nuevos[i]!.beats === paso.beats)
  );
}

/**
 * **La última sección de una AABA**: con dos secciones que empiezan igual y una que
 * contrasta, lo que falta es volver a la primera y cerrar. Si alguna de tus dos
 * primeras ya cerraba en casa, vuelve esa tal cual —la segunda antes, que es la que
 * suele cerrar—; si no, su cabeza y un cierre en la tónica (`cierresDesde`).
 *
 * Sin esto, a `AAB` se le proponía otra frase cualquiera, y la forma más corriente de
 * un estándar se quedaba sin su vuelta.
 */
export function laUltimaVuelta(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const falta = faltaALaForma(id, original, 'ultima-a');
  const tuyos = original.map((_, i) => tuyo(id, original, i));
  const copia = falta === null ? null : pasosDelTramo(tuyos, id.compas, falta.repite!);
  if (falta === null || copia === null) {
    return [];
  }
  const entera = falta.repite!.compases === falta.compases;
  const quedan = falta.compases - falta.repite!.compases;
  const [cierre] = entera
    ? []
    : cierresDesde(id, copia.at(-2)?.degree ?? null, copia.at(-1)!.degree, quedan, 1);
  /* v8 ignore next 3 -- desde cualquier grado hay un camino a casa en dos compases o mas: lo vigila la prueba de todos los grados de la segunda vuelta */
  if (!entera && cierre === undefined) {
    return [];
  }
  const cierran =
    cierre === undefined
      ? []
      : cierre.grados.map((grado) => paso(grado, id.compas, null, especieNueva(id, grado, null)));
  const dicho = copia.map((pasoTuyo) => pasoTuyo.degree).join(' ');
  return [
    {
      path: 'seguir',
      partes: [{ name: ULTIMA_VUELTA.nombre, yours: false, steps: [...copia, ...cierran] }],
      loQueSeAnade: 'misma',
      nombre: 'Vuelve tu primera parte: la AABA entera',
      que:
        cierre === undefined
          ? `Vuelve tu parte del principio, ${dicho}, que ya cerraba en la ${id.tonica}: con ella la forma AABA queda entera.`
          : `Vuelve tu parte del principio, ${dicho}, y llega a la ${id.tonica} por ${cierre.grados.join(' ')}: la forma AABA queda entera.`,
      prioridad: prioridadDe(2.6),
      familia: 'aaba',
    },
  ];
}
