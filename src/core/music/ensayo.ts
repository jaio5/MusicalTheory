import { blocksInOrder, findBlock, repeatsOf, type Arrangement } from './arrangement';
import type { DegreeSymbol } from './progressions';

/**
 * Ensayar lo que has escrito: el guion y la puntuación.
 *
 * TypeScript puro y a propósito. Aquí no hay micrófono, ni reloj, ni React: solo
 * **qué tocaba y qué pasó**. Quien escucha es `audio/chord-engine.ts`, quien
 * lleva el compás es el metrónomo, y los dos le cuentan a esto lo que ocurrió.
 * Así una canción entera se puntúa en un milisegundo y sin montar nada.
 *
 * **Tres resultados y no dos**, porque ensayar con un metrónomo tiene dos
 * maneras distintas de salir mal: no saber el acorde y no llegar a tiempo. Un
 * `fallado` y un `tarde` piden cosas distintas —mirar el mástil, o bajar el
 * tempo— y juntarlos en «mal» borra justo el consejo.
 *
 * **Y no hay castigo.** Aquí se cuenta lo que pasó; no hay vidas, ni volver al
 * principio, ni nada que se pierda. Es la misma regla que ya tiene aprender
 * ([adr/0007](../../../docs/adr/0007-elegir-por-donde-empezar.md)): fallar
 * ilumina el compás y se sigue.
 */

export type Acierto = 'acertado' | 'tarde' | 'fallado';

/** Un sitio del guion: qué acorde toca y en qué compás entra. */
export interface PasoDeEnsayo {
  /**
   * Qué bloque es. **No es único en el guion**: una parte con vueltas hace que
   * el mismo bloque aparezca varias veces, y eso es justo lo que permite contar
   * cuántas de las tres veces se te atragantó.
   */
  readonly blockId: string;
  readonly degree: DegreeSymbol;
  /** En qué compás entra, contando desde uno. Es lo que se dice en pantalla. */
  readonly bar: number;
  readonly beats: number;
}

export interface ResultadoDelEnsayo {
  readonly total: number;
  readonly acertados: number;
  readonly tarde: number;
  readonly fallados: number;
  /**
   * La racha más larga de acordes seguidos **a tiempo**.
   *
   * Un `tarde` la corta aunque el acorde fuera el bueno: una racha es de tocar
   * en su sitio, y si no midiera eso sería otra vez el número de aciertos.
   */
  readonly rachaMasLarga: number;
  /**
   * El que más se resistió, o nulo si no falló ninguno.
   *
   * Se cuenta **por bloque y no por compás**: con vueltas, el mismo acorde pasa
   * tres veces por sitios distintos, y lo que hace falta saber es qué acorde se
   * atraganta, no en cuál de las tres vueltas. El compás que se dice es el de la
   * primera vez que aparece, que es donde se va a buscar.
   */
  readonly peor: {
    readonly blockId: string;
    readonly degree: DegreeSymbol;
    readonly bar: number;
    readonly veces: number;
    readonly fallos: number;
  } | null;
}

/**
 * El guion: qué hay que tocar, en orden y con su compás.
 *
 * Sale de `blocksInOrder`, que es el mismo recorrido que usa la reproducción,
 * para que el compás que se enciende mientras suena y el que se puntúa sean el
 * mismo. Escribir aquí un segundo recorrido sería la manera de que un día
 * dejaran de coincidir.
 */
export function guionDeEnsayo(
  arrangement: Arrangement,
  beatsPerBar: number,
): readonly PasoDeEnsayo[] {
  const porCompas = Math.max(1, beatsPerBar);
  let pulsos = 0;

  return blocksInOrder(arrangement).flatMap((sitio) => {
    const encontrado = findBlock(arrangement, sitio.blockId);
    if (encontrado === null) {
      return [];
    }
    const paso: PasoDeEnsayo = {
      blockId: sitio.blockId,
      degree: encontrado.block.degree,
      bar: Math.floor(pulsos / porCompas) + 1,
      beats: encontrado.block.beats,
    };
    pulsos += encontrado.block.beats;
    return [paso];
  });
}

/** Cuántos acordes hay que tocar de principio a fin, vueltas incluidas. */
export function largoDelEnsayo(arrangement: Arrangement): number {
  return arrangement.parts.reduce((total, part) => total + part.blocks.length * repeatsOf(part), 0);
}

/**
 * La puntuación, a partir del guion y de lo que pasó en cada sitio.
 *
 * Las dos listas van emparejadas por posición. Si la segunda es más corta
 * —porque se paró a la mitad— se puntúa lo que se tocó y ya: un ensayo a medias
 * no es un ensayo fallado.
 */
export function puntuar(
  guion: readonly PasoDeEnsayo[],
  resultados: readonly Acierto[],
): ResultadoDelEnsayo {
  const hasta = Math.min(guion.length, resultados.length);

  let acertados = 0;
  let tarde = 0;
  let fallados = 0;
  let racha = 0;
  let rachaMasLarga = 0;

  /** Por bloque: cuántas veces pasó y cuántas se falló. */
  const porBloque = new Map<string, { veces: number; fallos: number; paso: PasoDeEnsayo }>();

  for (let indice = 0; indice < hasta; indice += 1) {
    const paso = guion[indice]!;
    const resultado = resultados[indice]!;

    if (resultado === 'acertado') {
      acertados += 1;
      racha += 1;
      rachaMasLarga = Math.max(rachaMasLarga, racha);
    } else {
      if (resultado === 'tarde') {
        tarde += 1;
      } else {
        fallados += 1;
      }
      racha = 0;
    }

    const cuenta = porBloque.get(paso.blockId) ?? { veces: 0, fallos: 0, paso };
    cuenta.veces += 1;
    if (resultado === 'fallado') {
      cuenta.fallos += 1;
    }
    porBloque.set(paso.blockId, cuenta);
  }

  // El peor es el que más veces se falló; a igualdad, el que llega antes, que es
  // el que se encuentra primero al volver a tocar.
  let peor: ResultadoDelEnsayo['peor'] = null;
  for (const { veces, fallos, paso } of porBloque.values()) {
    if (fallos === 0) {
      continue;
    }
    if (peor === null || fallos > peor.fallos || (fallos === peor.fallos && paso.bar < peor.bar)) {
      peor = { blockId: paso.blockId, degree: paso.degree, bar: paso.bar, veces, fallos };
    }
  }

  return { total: hasta, acertados, tarde, fallados, rachaMasLarga, peor };
}

/**
 * Si el ensayo cuenta como terminado.
 *
 * Terminado es **haber llegado al final**, no haberlo hecho bien: es lo que
 * decide si suma a la meta del día, y premiar solo lo perfecto sería poner una
 * nota de corte donde este proyecto decidió que no hubiera ninguna.
 */
export function ensayoTerminado(
  guion: readonly PasoDeEnsayo[],
  resultados: readonly Acierto[],
): boolean {
  return guion.length > 0 && resultados.length >= guion.length;
}
