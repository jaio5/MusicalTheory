/**
 * El camino `otro-final`: lo tuyo con otro cierre.
 *
 * Llegar a otro sitio, quitar tu color del final o acabar antes; lo que se cambia
 * es la cola, nunca el principio.
 */
import type { DegreeSymbol } from '../progressions';
import { prioridadDe, retoque, type Borrador } from './borrador';
import { buscarCaminos, cierresDesde, orden, type Admite } from './busqueda';
import { colorDelGrado } from './colores';
import { especieNueva, paso, tuyo } from './especies';
import { LARGO_DE_UNA_FRASE, llegadaSostenida, type Idioma } from './idioma';
import { MINIMO_DEL_MENU, type PasoPosible, type PathStep } from './tipos';
import { pulsosDe, saltosDe } from './validar';
import {
  deOtraGama,
  media,
  precioDelCamino,
  saltosDelCamino,
  valorDeCierre,
  valorDelSalto,
} from './valor';

/** Adónde puede ir otro final, y cómo se valora llegar ahí. */
interface Destino {
  readonly grado: DegreeSymbol;
  readonly nombre: string;
  /** Lo que hace, según el acorde de antes: el engaño solo existe después de una promesa. */
  readonly dice: string | ((penultimo: DegreeSymbol) => string);
  readonly valora: (
    desde: DegreeSymbol,
    antes: DegreeSymbol | null,
    grados: readonly DegreeSymbol[],
  ) => number;
}

/** Lo tuyo tal como lo ve otro final: partido en sus compases si es un acorde solo. */
interface Cola {
  readonly id: Idioma;
  readonly original: readonly PathStep[];
  readonly base: readonly PathStep[];
  readonly largo: number;
  /** El compás de tu llegada, si llega antes del final y se queda en casa. */
  readonly sostenida: number | null;
}

function colaDe(id: Idioma, original: readonly PathStep[]): Cola {
  // Un acorde solo no tiene segunda mitad en compases, y sí en pulsos: se parte en
  // sus compases, o en dos mitades si dura uno, y otro final cambia la de detrás.
  // Es lo que deja darle a un acorde un acompañamiento —`I` pasa a `I V`— sin
  // tocar lo que dice la tonalidad, que es el principio.
  const base = original.length === 1 ? partirElAcorde(id, original[0]!) : original;
  return {
    id,
    original,
    base,
    largo: base.length,
    sostenida: base === original ? llegadaSostenida(id, original) : null,
  };
}

/**
 * Lo tuyo que se queda, y lo nuevo con los pulsos del compás que sustituye. Lo
 * tuyo de un acorde partido vuelve a ser un acorde.
 */
function montar(
  { id, original, base }: Cola,
  desde: number,
  grados: readonly DegreeSymbol[],
  fin: number,
): PasoPosible[] {
  const quedan =
    base === original
      ? original.slice(0, desde).map((_, i) => tuyo(id, original, i))
      : [{ ...tuyo(id, original, 0), beats: pulsosDe(base.slice(0, desde)) }];
  return [
    ...quedan,
    ...grados.map((degree, k) =>
      paso(degree, base[desde + k]!.beats, null, especieNueva(id, degree, null)),
    ),
    ...base.slice(fin + 1).map((_, k) => tuyo(id, original, fin + 1 + k)),
  ];
}

/** Adónde puede ir otro final de lo tuyo: cerrar, quedarse abierto o caer en el sexto. */
function destinosDelFinal(cola: Cola): {
  readonly destinos: readonly Destino[];
  readonly cierra: Destino;
} {
  const { id, original, sostenida } = cola;
  const tonica = id.tonica;
  const sexto: DegreeSymbol = id.mode === 'major' ? 'vi' : 'VI';
  const ultimoTuyo = original.at(-1)!.degree;
  const valorDeLlegada = (
    desde: DegreeSymbol,
    grados: readonly DegreeSymbol[],
    premio: (penultimo: DegreeSymbol) => number,
  ) =>
    media(saltosDelCamino(id, desde, grados)) +
    precioDelCamino(id, grados) +
    premio([desde, ...grados].at(-2)!);
  // La llegada abierta de una canción sin sensible es la suya —el bVII de un riff
  // mixolidio, la v de un folk eólico, el VII si ya acabas en el bII—, no un V que
  // le metería la sensible que no tiene.
  const modal = id.modales.find((grado) => grado !== ultimoTuyo);
  const abierta: Destino =
    id.modales.length > 0 && modal !== undefined
      ? {
          grado: modal,
          nombre: `Se queda en el ${modal}`,
          dice: `acaba en ${modal}, abierto y sin sensible: pide seguir`,
          valora: (desde, _, grados) =>
            valorDeLlegada(desde, grados, (p) =>
              ['IV', 'iv', 'bVI', 'VI', 'III'].includes(p) ? 0.6 : 0,
            ),
        }
      : {
          grado: 'V',
          nombre: 'Se queda en la dominante',
          dice: 'acaba en V, abierto: pide seguir',
          valora: (desde, _, grados) =>
            valorDeLlegada(desde, grados, (p) =>
              ['ii', 'IV', 'iv', 'ii°', 'V/V', 'bVI', 'VI'].includes(p) ? 0.6 : 0,
            ),
        };
  // Cerrar en la tónica es otro final de lo que no cerraba; de lo que ya cerraba
  // es otra cadencia, y se dice así. Una entrada no se cierra: lleva a la estrofa.
  // Y un vaivén modal no se cierra en la tónica de la armadura, que no es su centro
  // (lo mismo que hace `continuaciones`).
  // Un acorde solo, aunque sea la tónica, no tenía cadencia: se le pone una.
  const yaCerraba = ultimoTuyo === tonica && original.length > 1;
  const cierra: Destino = {
    grado: tonica,
    nombre: yaCerraba
      ? 'Otra cadencia'
      : ultimoTuyo === tonica
        ? 'Una cadencia'
        : 'Cierra en la tónica',
    dice: yaCerraba
      ? 'llega a la tónica por otro camino'
      : ultimoTuyo === tonica
        ? 'sale de la tónica y vuelve a ella'
        : 'llega a la tónica',
    valora: (desde, antes, grados) => valorDeCierre(id, antes, desde, grados),
  };
  // Si lo tuyo llega antes del final y se queda en casa, la llegada es la de ese
  // compás (`llegadaSostenida`): otro final que cierra la prepara de otra manera, y
  // lo que la sostiene se queda. **Quedarse abierto depende de lo que llega**: una
  // frase que llega y se sostiene —`ii V I I`— tiene en el compás que sostiene el
  // sitio de la vuelta, y ahí cabe `ii V I vi`; un periodo de dos frases que
  // cierra —`… IV V I I`— ha acabado, y dejarlo abierto es quitarle la llegada.
  const periodo = sostenida !== null && pulsosDe(original) > id.frase;
  const puedeCerrar = id.centroModal === null && id.papel !== 'intro' && id.papel !== 'pre';
  const cae: Destino = {
    grado: sexto,
    nombre: `Cae en el ${sexto}`,
    // Engañar al oído es romper lo que prometía una dominante: `V vi`. Desde la
    // tónica o desde un iv no había promesa, y llegar al sexto grado es quedarse
    // abierto cerca de casa, no un engaño. **Ni desde la v menor**: sin sensible no
    // promete la tónica, y el `v VI` es la bajada del eólico, no una rota.
    dice: (penultimo) =>
      ['V', 'vii°'].includes(penultimo)
        ? `acaba en ${sexto} en vez de en la tónica: engaña al oído`
        : `acaba en ${sexto}, que comparte dos notas con la tónica: se queda abierto sin irse de casa`,
    valora: (desde, _, grados) => valorDeLlegada(desde, grados, (p) => (p === 'V' ? 0.9 : 0)),
  };
  return {
    cierra,
    destinos: [
      ...(puedeCerrar ? [cierra] : []),
      ...(periodo ? [] : [abierta]),
      // El sexto grado de un blues o un funk es de otra gama (`deOtraGama`).
      ...(periodo || deOtraGama(id, sexto) ? [] : [cae]),
    ],
  };
}

/** Un trozo nuevo que llega a un destino, con lo que vale. */
interface FinalPosible {
  readonly desde: number;
  readonly grados: readonly DegreeSymbol[];
  readonly valor: number;
}

/**
 * Todas las maneras de llegar a un destino con los mismos compases: el trozo
 * nuevo acaba en `fin`, empieza no antes de `desdeMin` y deja en pie la mitad de
 * lo tuyo.
 */
function posiblesHacia(
  cola: Cola,
  destino: Destino,
  fin: number,
  desdeMin: number,
): FinalPosible[] {
  const { id, original, base, largo } = cola;
  const posibles: FinalPosible[] = [];
  const hasta = Math.min(LARGO_DE_UNA_FRASE, fin + 1 - Math.ceil(largo / 2), fin + 1 - desdeMin);
  for (let k = 1; k <= hasta; k += 1) {
    const desde = fin + 1 - k;
    const previo = base[desde - 1]!.degree;
    const antes = base[desde - 2]?.degree ?? null;
    const admite: Admite = (grado, i, anterior) =>
      i === k - 1
        ? grado === destino.grado && anterior !== grado
        : grado !== destino.grado && grado !== id.tonica;
    for (const grados of buscarCaminos(id, previo, k, admite)) {
      if (!grados.every((grado, j) => grado === base[desde + j]!.degree)) {
        posibles.push({
          desde,
          grados,
          valor:
            destino.valora(previo, antes, grados) -
            0.1 * (k - 1) -
            (quitaTuColor(id, original, desde, desde + k - 1, grados) ? 1 : 0),
        });
      }
    }
  }
  return posibles;
}

/** Las mejores maneras de llegar a un destino, una por acorde de antes y hasta `cuantas`. */
function finalesHacia(
  cola: Cola,
  destino: Destino,
  tramo: { readonly fin: number; readonly desdeMin: number },
  cuantas: number,
): Borrador[] {
  const { id, base } = cola;
  const { fin } = tramo;
  const borradores: Borrador[] = [];
  const vistos = new Set<DegreeSymbol>();
  const posibles = posiblesHacia(cola, destino, fin, tramo.desdeMin);
  for (const elegido of posibles.sort((a, b) => b.valor - a.valor || orden(a.grados, b.grados))) {
    const penultimo = [base[elegido.desde - 1]!.degree, ...elegido.grados].at(-2)!;
    if (vistos.size >= cuantas || vistos.has(penultimo)) {
      continue;
    }
    vistos.add(penultimo);
    borradores.push({
      path: 'otro-final',
      partes: retoque(montar(cola, elegido.desde, elegido.grados, fin)),
      // Si hay varias, cada una dice por dónde llega.
      nombre: cuantas > 1 ? `${destino.nombre} desde el ${penultimo}` : destino.nombre,
      que: `${desdeElPulso(id, pulsosDe(base.slice(0, elegido.desde)))}, ${[...elegido.grados, ...base.slice(fin + 1).map((p) => p.degree)].join(' ')}: ${typeof destino.dice === 'string' ? destino.dice : destino.dice(penultimo)}.`,
      prioridad: prioridadDe(elegido.valor),
      familia: `final:${destino.grado}`,
    });
  }
  return borradores;
}

/**
 * La promesa que tu penúltimo no cumple: si es una dominante secundaria y tu
 * último compás no es lo que prepara, el último pasa a serlo. `V/iii ii` acaba
 * en el iii que el VII7 anunciaba; ninguno de los tres finales de arriba lo
 * arregla, porque desde ahí no se llega ni a la tónica ni a la V.
 */
function laPromesa(cola: Cola): Borrador | null {
  const { id, base, largo } = cola;
  const penultimo = base[largo - 2]?.degree;
  if (!penultimo?.includes('/')) {
    return null;
  }
  // Lo primero del grafo de una secundaria es lo que prepara.
  const prepara = saltosDe(id.mode, penultimo)[0]!.to;
  if (prepara === base[largo - 1]!.degree) {
    return null;
  }
  return {
    path: 'otro-final',
    partes: retoque(montar(cola, largo - 1, [prepara], largo - 1)),
    nombre: `Llega al ${prepara}`,
    que: `El último compás pasa a ${prepara}, que es lo que prepara tu ${penultimo}.`,
    prioridad: prioridadDe(valorDelSalto(id, penultimo, prepara)),
    familia: 'final:prometido',
  };
}

/**
 * Otro final: llegar a la tónica, quedarse en la dominante o caer en el sexto
 * grado, **con los mismos compases**; y acabar antes, si se puede acabar en frase.
 *
 * Antes buscaba el cambio más tardío y no el mejor, y acortaba la canción un
 * compás para llegar antes: un 4 se quedaba en 3, un 12 en 11. Ahora el trozo nuevo
 * ocupa lo mismo que el que sustituye, y de los que llegan gana el que mejor
 * llega; a igualdad, el que toca menos.
 */
export function otrosFinales(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const cola = colaDe(id, original);
  const { sostenida, largo } = cola;
  const { destinos, cierra } = destinosDelFinal(cola);
  // Un final y un estribillo tienen que llegar a casa —el juez descarta lo que los
  // deja abiertos—, así que ahí se buscan varias maneras de llegar, una por acorde
  // de antes; en lo demás, la mejor de cada destino.
  const llega =
    (id.papel === 'final' || id.papel === 'estribillo') && original.at(-1)!.degree !== id.tonica;
  const borradores = destinos.flatMap((destino) =>
    finalesHacia(
      cola,
      destino,
      // Hasta dónde llega el tramo nuevo y desde dónde puede empezar: el que cierra
      // acaba en tu llegada, y el que se queda abierto empieza detrás de ella.
      destino === cierra || sostenida === null
        ? { fin: sostenida ?? largo - 1, desdeMin: 0 }
        : { fin: largo - 1, desdeMin: sostenida + 1 },
      llega && destino.grado === id.tonica ? MINIMO_DEL_MENU + 1 : 1,
    ),
  );
  const promesa = laPromesa(cola);
  return [...borradores, ...(promesa === null ? [] : [promesa]), ...acabaAntes(id, original)];
}

/**
 * Si cambiar tus compases de `desde` a `hasta` por esos grados **te deja sin el
 * color** que hacía tuya la canción: el iv de `I IV iv I`, el sus4 que retiene el
 * V. Otro final cambia el final, no la canción: entre dos maneras de acabar, la que
 * se lleva todo tu color va detrás, aunque el color fuera tu último acorde —un soul
 * en `I vi IV iv` acabado en `I vi IV I` ya no es soul—. El juez le pone el mismo
 * reparo. Antes esto no se miraba, y en un folk el único «se queda en la dominante»
 * de `I IV iv I` era `I IV ii V`, sin el iv.
 */
function quitaTuColor(
  id: Idioma,
  original: readonly PathStep[],
  desde: number,
  hasta: number,
  grados: readonly DegreeSymbol[],
): boolean {
  const colorTuyo = (i: number) =>
    colorDelGrado(id.mode, original[i]!.degree, id.especies[i] ?? null);
  // Lo que queda sonando: lo tuyo fuera del tramo y lo que pone.
  const quedan = new Set([
    ...original
      .map((_, i) => i)
      .filter((i) => i < desde || i > hasta)
      .map(colorTuyo),
    ...grados.map((grado) => colorDelGrado(id.mode, grado, especieNueva(id, grado, null))),
  ]);
  // Cada clase de color tuya que se pierde entera, también la que era tu final.
  return original.some((_, i) => {
    const suyo = colorTuyo(i);
    return suyo !== null && !quedan.has(suyo);
  });
}

/**
 * Acabar antes, pero en frase: lo más largo que cuadra y deja en pie la mitad.
 *
 * **Solo si tu canción no cuadraba ya**: si mide frases enteras —un AABA de
 * treinta y dos, dos frases de tres—, quitarle compases no cuadra nada, rompe la
 * forma. Y dice lo que mide en compases, no en acordes: con dos acordes por compás
 * los dos números no se parecen.
 */
function acabaAntes(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const largo = original.length;
  const suelo = Math.ceil(largo / 2);
  if (pulsosDe(original) % id.frase === 0) {
    return [];
  }
  for (let corto = largo - 1; corto >= Math.max(suelo, 2); corto -= 1) {
    if (pulsosDe(original.slice(0, corto)) % id.frase !== 0) {
      continue;
    }
    let mejor: { grados: readonly DegreeSymbol[]; valor: number } | null = null;
    for (let k = 1; k <= Math.min(LARGO_DE_UNA_FRASE, corto - suelo); k += 1) {
      const desde = original[corto - k - 1]!.degree;
      // Con «acaba antes» quedan al menos dos compases tuyos delante del cambio.
      const antes = original[corto - k - 2]!.degree;
      const [cierre] = cierresDesde(id, antes, desde, k, 1);
      if (cierre !== undefined && (mejor === null || cierre.valor - 0.1 * (k - 1) > mejor.valor)) {
        mejor = { grados: cierre.grados, valor: cierre.valor - 0.1 * (k - 1) };
      }
    }
    if (mejor === null) {
      return [];
    }
    const desde = corto - mejor.grados.length;
    const cancion = [
      ...original.slice(0, desde).map((_, i) => tuyo(id, original, i)),
      ...mejor.grados.map((degree, k) =>
        paso(degree, original[desde + k]!.beats, null, especieNueva(id, degree, null)),
      ),
    ];
    const compases = (pasos: readonly PathStep[]) => compasesEnPalabras(id, pulsosDe(pasos));
    return [
      {
        path: 'otro-final',
        partes: retoque(cancion),
        nombre: 'Acaba antes',
        que: `${desdeElPulso(id, pulsosDe(original.slice(0, desde)))}, ${mejor.grados.join(' ')}: llega a la tónica en ${compases(cancion)} y no en ${compases(original)}, y la frase cuadra.`,
        prioridad: prioridadDe(mejor.valor - 0.3),
        familia: 'acaba-antes',
      },
    ];
  }
  return [];
}

/**
 * «8 compases» o, si no son compases enteros, «18 pulsos». Nunca uno: lo que se
 * acorta cuadra una frase, que tiene tres compases o más.
 */
function compasesEnPalabras(id: Idioma, pulsos: number): string {
  return pulsos % id.compas === 0 ? `${pulsos / id.compas} compases` : `${pulsos} pulsos`;
}

/** «Desde el compás 3», «Desde la mitad del compás 1»: dónde empieza algo, en compases de verdad. */
function desdeElPulso(id: Idioma, pulso: number): string {
  const compas = Math.floor(pulso / id.compas) + 1;
  const dentro = pulso % id.compas;
  if (dentro === 0) {
    return `Desde el compás ${compas}`;
  }
  return dentro * 2 === id.compas
    ? `Desde la mitad del compás ${compas}`
    : `Desde el pulso ${dentro + 1} del compás ${compas}`;
}

/**
 * Un acorde solo, partido para poder cambiarle la segunda mitad: en sus compases
 * si dura varios, o en dos mitades si dura uno y se puede partir por el pulso.
 */
function partirElAcorde(id: Idioma, acorde: PathStep): PathStep[] {
  const { degree, beats } = acorde;
  if (beats > id.compas && beats % id.compas === 0) {
    return Array.from({ length: beats / id.compas }, () => ({ degree, beats: id.compas }));
  }
  return beats % 2 === 0
    ? [
        { degree, beats: beats / 2 },
        { degree, beats: beats / 2 },
      ]
    : [acorde];
}
