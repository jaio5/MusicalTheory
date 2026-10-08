/**
 * Lo que se manda de una parte para pedirle salidas: cada bloque como un compás,
 * con lo que el lienzo sabe de él.
 *
 * Se mandaban el grado y los pulsos y nada más, así que la séptima de un blues,
 * la duda de lo que leyó el micro y el punteo que va encima se quedaban en el
 * navegador, y las salidas se construían sobre otra canción. Todo lo que sale de
 * aquí son símbolos —enumerados, números y alturas sobre la tónica—: ni audio ni
 * texto libre, y **el nombre de la parte tampoco**, que lo escribe quien compone.
 *
 * TypeScript puro y sin estado, para probarlo sin pintar el panel.
 */

import {
  DUDOSO,
  isDoubtful,
  normalizePitchClass,
  type CapturedStep,
  type NotaDelCompas,
  type Part,
} from '@core/music';

import { MAX_NOTAS_POR_COMPAS, type SalidaStep } from './peticion';

/**
 * Si en ese pulso de la parte cae un tiempo fuerte.
 *
 * El primero de cada compás, y en los compases pares de cuatro o más también el
 * de la mitad: el tres de un 4/4 y el cuatro de un 6/8 (`BEATS_PER_BAR`). Se
 * cuenta desde el principio de la parte, que es donde empieza su primer compás.
 */
export function esPulsoFuerte(pulso: number, pulsosPorCompas: number): boolean {
  const porCompas = Math.max(1, Math.round(pulsosPorCompas));
  const dentro = pulso % porCompas;
  return dentro === 0 || (porCompas >= 4 && porCompas % 2 === 0 && dentro === porCompas / 2);
}

/**
 * Las notas del punteo que suenan entre esos dos pulsos, cada altura una vez.
 *
 * **Suena** y no «empieza»: una nota ligada que cruza la barra suena en los dos
 * compases. Y es **fuerte** si está sonando cuando cae un tiempo fuerte, empiece
 * donde empiece, porque lo que se oye en el tiempo fuerte es lo que más tiene que
 * encajar con el acorde.
 */
function notasEntre(
  parte: Part,
  desde: number,
  hasta: number,
  pulsosPorCompas: number,
): NotaDelCompas[] {
  const notas: NotaDelCompas[] = [];
  const ordenadas = [...parte.notes].sort((a, b) => a.start - b.start);
  for (const nota of ordenadas) {
    const empieza = Math.max(desde, nota.start);
    const acaba = Math.min(hasta, nota.start + nota.length);
    if (empieza >= acaba) {
      continue;
    }
    let fuerte = false;
    for (let pulso = Math.ceil(empieza); pulso < acaba && !fuerte; pulso += 1) {
      fuerte = esPulsoFuerte(pulso, pulsosPorCompas);
    }
    const altura = normalizePitchClass(nota.offset);
    const ya = notas.findIndex((otra) => otra.nota === altura);
    if (ya === -1) {
      notas.push({ nota: altura, fuerte });
    } else if (fuerte) {
      notas[ya] = { nota: altura, fuerte };
    }
  }
  // Doce como mucho, y nunca se llega: son las doce alturas, cada una una vez.
  return notas.slice(0, MAX_NOTAS_POR_COMPAS);
}

/**
 * Los compases de una parte, como viajan.
 *
 * El último bloque se queda con las notas que se salen por el final, que es lo
 * que hace `chordAt`: una frase que se estira por encima de lo que ya sonaba.
 */
export function pasosDeLaParte(parte: Part, pulsosPorCompas: number): SalidaStep[] {
  let desde = 0;
  return parte.blocks.map((block, i) => {
    const hasta = i === parte.blocks.length - 1 ? Number.POSITIVE_INFINITY : desde + block.beats;
    const notas = notasEntre(parte, desde, hasta, pulsosPorCompas);
    desde += block.beats;
    return {
      degree: block.degree,
      beats: block.beats,
      // Lo que el micro leyó con duda y nadie ha mirado: es lo mismo que el
      // lienzo marca para preguntar (`isDoubtful`).
      ...(isDoubtful(block) ? { heard: true } : {}),
      ...(block.especie === undefined ? {} : { especie: block.especie }),
      ...(notas.length > 0 ? { notas } : {}),
    };
  });
}

/**
 * Lo grabado, como viaja: el grado, lo que duró y si el motor dudó.
 *
 * La confianza y las alternativas se quedan aquí —gastaban tokens sin que nadie
 * las leyera—: de todo eso solo sirve si el compás es dudoso.
 */
export function pasosDeLoGrabado(grabado: readonly CapturedStep[]): SalidaStep[] {
  return grabado.map((paso) => ({
    degree: paso.degree,
    beats: paso.beats,
    ...(paso.confidence < DUDOSO ? { heard: true } : {}),
  }));
}
