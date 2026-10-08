/**
 * Criterio 9: la novedad frente a la coherencia.
 */
import { veces } from '../../../cifras';
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import type { StyleId } from '../../styles';
import { familiaDelGrado } from './estilo';
import {
  acotar,
  bVIIDeLaCasa,
  compasDe,
  enEstilo,
  PRESTADOS_EN_MAYOR,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';
import { cuadraLaToma } from './ritmo-armonico';

/**
 * Si tu canción, en mayor, **vive de la mezcla con el menor**: más de la mitad de
 * los compases que no son la tónica son prestados —`I iv I iv`, `I bVI bVII I`, `I
 * iv I bVI`—, y ninguno es una dominante secundaria. Es el idioma de la música de
 * cine y del rock épico, y su color sale del menor paralelo: la escalera
 * bVI–bVII–I, el iv que nubla la plagal, el bIII.
 *
 * Un iv de paso en una canción de la escala —el `I vi IV iv` de un soul, el `I IV iv
 * I` de un cantautor— no es eso: ahí el color es un acento, y las secundarias caben
 * al lado (el arreglista pide un III7 en ese mismo soul). Lo usa también quien
 * construye las salidas (`salidas/`).
 */
export function vivePrestado(mode: KeyMode, grados: readonly DegreeSymbol[]): boolean {
  const fuera = grados.filter((grado) => grado !== 'I');
  const prestados = fuera.filter((grado) => PRESTADOS_EN_MAYOR.has(grado) || grado === 'bII');
  return (
    mode === 'major' &&
    prestados.length * 2 > fuera.length &&
    !grados.some((grado) => grado.includes('/'))
  );
}

/**
 * Cuántos préstamos caben antes de que la canción cambie de color: sin tope donde lo
 * prestado es la casa —el rock, el metal y el cine, que viven del menor—, dos donde
 * es un color corriente —el bIII y el bVII del blues y del funk, el bII del flamenco—
 * y uno en lo demás.
 */
function topeDePrestamos(j: Juicio): number {
  if (j.estilo === 'rock' || j.estilo === 'metal' || j.estilo === 'cine') {
    return Number.POSITIVE_INFINITY;
  }
  return j.estilo === 'blues' || j.estilo === 'funk' || j.estilo === 'flamenco' ? 2 : 1;
}

/**
 * Los estilos en los que **repetir tu vuelta es el idioma**: el riff del rock, el coro
 * del blues, el vamp del funk y del reggae, la andaluza que vuelve a bajar y el
 * ostinato del cine. En lo demás, repetir no aporta nada que no tuvieras.
 */
const REPETIR_ES_IDIOMA: ReadonlySet<StyleId> = new Set([
  'rock',
  'blues',
  'funk',
  'reggae',
  'flamenco',
  'cine',
]);

function conTopeDePrestamos(j: Juicio, hecho: Hecho): Hecho {
  // Lo que ya tocas es tu idioma y no cuenta, y si tu canción vive de lo prestado
  // (`vivePrestado`), no hay tope: es su color, no uno que se le añade.
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  if (vivePrestado(j.mode, [...j.original.map((acorde) => acorde.degree)])) {
    return hecho;
  }
  const prestados = [...j.cambiados]
    .map((i) => j.cancion[i]!)
    .filter((acorde) => {
      const familia = familiaDelGrado(j, acorde);
      const deLaCasa = acorde.degree === 'bVII' && bVIIDeLaCasa(j.estilo);
      return (
        !tuyos.has(acorde.degree) &&
        ((familia === 'borrowed' && !deLaCasa) || familia === 'neapolitan')
      );
    });
  const sobran = prestados.length - topeDePrestamos(j);
  if (sobran <= 0) {
    return hecho;
  }
  const cuales = [...new Set(prestados.map((acorde) => acorde.degree))].join(', ');
  return {
    valor: acotar(hecho.valor - 0.35 * sobran),
    motivo: `${prestados.length} compases prestados (${cuales}): más de lo que pide una canción ${enEstilo(j)}.`,
  };
}

export function novedad(j: Juicio, vamp: boolean, blues: boolean): Hecho {
  if (j.kind === 'retocar') {
    return conTopeDePrestamos(j, novedadAlRetocar(j, blues));
  }
  const parte = j.cancion.slice(j.original.length).map((acorde) => acorde.degree);
  const tuyos = j.original.map((acorde) => acorde.degree);
  if (parte.length === 0) {
    return { valor: -1, motivo: 'No añade ningún compás a lo tuyo.' };
  }
  const comparte =
    new Set(parte.filter((grado) => tuyos.includes(grado))).size / new Set(parte).size;
  let hecho: Hecho;
  if (j.path === 'contraste') {
    // Y la que se va no vuelve a casa por el camino: cada tónica en medio de la
    // parte nueva le quita contraste, que es lo único que se le pide.
    const tonicas = parte.filter((grado) => grado === j.tonica).length;
    hecho =
      comparte <= 0.5
        ? { valor: 1, motivo: 'La parte nueva va a acordes que tú no tocas: contrasta.' }
        : comparte < 1
          ? { valor: 0.3, motivo: 'La parte nueva repite buena parte de tus acordes.' }
          : { valor: -0.5, motivo: 'La parte nueva usa solo tus acordes: no contrasta.' };
    if (tonicas > 0) {
      hecho = {
        valor: acotar(hecho.valor - 0.4 * tonicas),
        motivo: `La parte nueva pasa ${veces(tonicas)} por la ${j.tonica}: contrasta menos.`,
      };
    }
  } else if (parte.join(' ') === tuyos.join(' ')) {
    // Repetir tu vuelta es lo que se hace en un vamp, un riff o un blues: otro
    // coro. En lo demás no aporta nada que no tuvieras.
    const idioma = vamp || (j.estilo !== undefined && REPETIR_ES_IDIOMA.has(j.estilo));
    hecho = idioma
      ? { valor: 0.5, motivo: 'Repite tu vuelta, otro coro.' }
      : { valor: 0, motivo: 'Repite tu vuelta sin aportar nada.' };
  } else if (comparte === 0) {
    hecho = { valor: -0.2, motivo: 'El cierre no usa ninguno de tus acordes.' };
  } else {
    hecho = {
      valor: 0.6,
      motivo:
        j.cancion[j.cancion.length - 1]!.funcion === 'tonica'
          ? 'Sigue con tus acordes y añade lo que hace falta para cerrar.'
          : 'Sigue con tus acordes y añade otros nuevos.',
    };
  }
  return conTopeDePrestamos(j, hecho);
}

/** El acorde con su especie, como se nombra en un motivo: `V(sus4)`. */
function nombreDe(acorde: Acorde): string {
  return acorde.especie === null ? acorde.degree : `${acorde.degree}(${acorde.especie})`;
}

/**
 * Si un acorde es **color** y de dónde viene: lo que la tonalidad de manual no trae
 * —un préstamo, un napolitano, una dominante secundaria o un sustituto— o un
 * suspendido que retiene la tercera. Nulo si no es color. Por el modo y no por el
 * estilo: un bVII es de la casa en rock, pero sigue siendo lo que hace que tu riff
 * sea ese y no `I IV V`.
 *
 * Hace falta porque un color no se cambia por otro de otra casa: el iv de un soul
 * cambiado por un III7 deja la canción sin nada prestado, y el arreglista lo tachó
 * aunque «pusiera otro color». Lo mismo dice quien construye las salidas
 * (`colores.ts`, `colorDelGrado`).
 */
function colorDe(mode: KeyMode, acorde: Acorde): 'prestado' | 'secundaria' | 'suspendido' | null {
  // En menor el bII es de la casa —el frigio, el napolitano del menor armónico—: el
  // catálogo del menor ya lo trae (`prestamo`, en `movimientos.ts`). Cambiarlo por
  // la subdominante que inflexiona no le quita el color a la canción: es el cambio de
  // casa que el arreglista pide en un metal neoclásico. En mayor sí viene de fuera.
  if (mode === 'major' && (acorde.degree === 'bII' || PRESTADOS_EN_MAYOR.has(acorde.degree))) {
    return 'prestado';
  }
  if (acorde.funcion === 'secundaria' || acorde.funcion === 'tritono') {
    return 'secundaria';
  }
  return acorde.especie === 'sus2' || acorde.especie === 'sus4' ? 'suspendido' : null;
}

function novedadAlRetocar(j: Juicio, blues: boolean): Hecho {
  const n = j.original.length;
  const cambiados = j.cancion.filter(
    (acorde, i) => j.original[i]?.degree !== acorde.degree && i < n,
  ).length;
  const primero = j.original[0]!;
  // También cuando lo que entra armoniza tu punteo (`salidas/` lo construye): sigue
  // siendo cambiar el sitio donde la canción dice su tonalidad, y los arreglistas lo
  // tachan con un punteo encima igual que sin él. Queda para la red, detrás de todo.
  if (primero.funcion === 'tonica' && j.cancion[0]!.degree !== primero.degree) {
    return {
      valor: -1,
      motivo: `Cambia el ${primero.degree} del compás 1, que es donde la canción dice su tonalidad.`,
      reparo: `cambia la tónica del compás 1`,
    };
  }
  const ultimo = j.original[n - 1]!;
  // En un blues la llegada es la tónica del 11, y el 12 es la vuelta al coro
  // siguiente: poner ahí la V del turnaround no quita nada.
  const turnaround = blues && j.cancion[n - 2]?.funcion === 'tonica';
  // Y si lo tuyo llega antes del final y se sostiene, la llegada es el compás en que
  // llega. Lo que la sostiene es el final en un periodo de dos frases; en una frase
  // sola es el sitio de la vuelta —`ii V I vi`, `VI VII i III`—, y cambiarlo no la
  // quita (lo mismo construye `salidas/`).
  let llegada = n - 1;
  while (llegada > 0 && j.original[llegada - 1]!.funcion === 'tonica') {
    llegada -= 1;
  }
  const periodo = j.largoOriginal > j.frase;
  // Rearmonizar no cambia el largo: la canción tiene tus mismos compases.
  const quita = () =>
    j.cancion[llegada]!.funcion !== 'tonica' ||
    ((periodo || llegada === 0) && j.cancion[n - 1]!.funcion !== 'tonica');
  if (j.path === 'rearmonizar' && ultimo.funcion === 'tonica' && !turnaround && quita()) {
    return {
      valor: -0.8,
      motivo: `Quita la llegada a ${ultimo.degree} del compás ${compasDe(j, j.original[llegada]!)}, que ya cerraba.`,
    };
  }
  if (cambiados === 0) {
    return cuadraLaToma(j) === true
      ? { valor: 0.8, motivo: 'Cuadra tu toma sin tocar un solo acorde.' }
      : { valor: 0, motivo: 'Los mismos acordes: lo nuevo es el reparto.' };
  }
  // Rearmonizar es poner **otro** acorde. El que copia al de al lado no pone
  // ninguno: alarga el vecino y se lleva el que había —`ii ii` donde había `V/V
  // ii`, `bII bII7` donde había `bII V`—, y la novedad no lo pesaba más que
  // cualquier otro cambio. Lo que se repetía ya en lo tuyo no cuenta.
  if (j.path === 'rearmonizar') {
    const copia = [...j.cambiados].find((i) =>
      [i - 1, i + 1].some(
        (vecino) =>
          j.cancion[vecino]?.degree === j.cancion[i]!.degree &&
          j.original[vecino]?.degree !== j.original[i]!.degree,
      ),
    );
    if (copia !== undefined) {
      const grado = j.cancion[copia]!.degree;
      return {
        valor: -1,
        motivo: `El ${copia + 1} pasa a ser ${grado}, el mismo de al lado: no pone otro acorde, alarga uno.`,
        reparo: `repite el ${grado} de al lado`,
      };
    }
  }
  // Lo que hace tuya la canción es su color: el iv de `I IV iv I`, el sus4 que
  // retiene el V. Una salida que lo quita entero y no pone otro deja la canción
  // de manual, y eso no es retocarla.
  // **Cada clase de color**, no el color a secas: el iv cambiado por un III7 pone
  // color, pero ya no es el tuyo (`colorDe`).
  const quedan = new Set(j.cancion.map((acorde) => colorDe(j.mode, acorde)));
  const perdida = (acorde: Acorde) => {
    const suyo = colorDe(j.mode, acorde);
    return suyo !== null && !quedan.has(suyo);
  };
  const tuyos = new Set(j.original.filter(perdida).map(nombreDe));
  if (tuyos.size > 0) {
    // **También si el color era tu último acorde y lo que se pide es otro final**:
    // cambiar el final no obliga a dejar la canción de manual. El `I vi IV iv` de un
    // soul acabado en `I vi IV I` ha perdido lo que lo hacía soul, y el arreglista lo
    // tachó; antes aquí se le perdonaba porque «no podía dejarlo en su sitio».
    return {
      valor: -1,
      motivo: `Quita ${[...tuyos].join(' y ')}, el color que hacía tuya la canción, y no pone otro.`,
      reparo: 'quita el color que hacía tuya la canción',
    };
  }
  // Retocar es enriquecer: una salida que deja tu canción con menos acordes
  // distintos que los que tenía la empobrece aunque cada enlace sea bueno. `I IV I
  // V` con el IV cambiado por V es un vaivén de dos acordes, no tu frase retocada.
  const distintos = (acordes: readonly Acorde[]) =>
    new Set(acordes.map((acorde) => acorde.degree)).size;
  if (distintos(j.cancion) < distintos(j.original)) {
    return {
      valor: -0.5,
      motivo: `Se queda con ${distintos(j.cancion)} acordes distintos de los ${distintos(j.original)} que tenías: empobrece.`,
    };
  }
  const parte = cambiados / n;
  if (cambiados === 1) {
    return { valor: 0.7, motivo: 'Cambia un solo compás: tu canción sigue siendo la tuya.' };
  }
  if (parte <= 0.5) {
    return {
      valor: 1,
      motivo: `Cambia ${cambiados} de ${n} compases: se nota y sigue siendo tuya.`,
    };
  }
  return parte <= 0.75
    ? { valor: -0.2, motivo: `Cambia ${cambiados} de ${n} compases: más de la mitad.` }
    : { valor: -1, motivo: `Cambia ${cambiados} de ${n} compases: ya no es tu canción.` };
}
