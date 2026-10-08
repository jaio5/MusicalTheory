/**
 * La canción, convertida en un fichero MIDI.
 *
 * **Es lo único que saca de aquí lo que has compuesto.** Hasta ahora lo único
 * descargable era el audio de lo que tocaste; el montaje —los acordes, sus
 * duraciones y el punteo— vivía dentro de la aplicación y no salía. Se compone
 * para llevárselo a un secuenciador, imprimirlo o mandárselo a alguien, así que
 * sin esto la aplicación es un cuaderno del que no se arrancan hojas.
 *
 * Va en `core/` y es TypeScript puro: escribir bytes no necesita navegador. Lo
 * que sí lo necesita —pedir la descarga— vive en `media/`.
 *
 * Se escribe un **formato 0**: una sola pista con todo dentro. La alternativa
 * era el formato 1, con el acompañamiento y el punteo en pistas separadas, y no
 * se hace porque `soundOf` ya entrega las dos cosas mezcladas contra el mismo
 * reloj —que es justo lo que hace que suenen juntas— y separarlas obligaría a
 * recorrer el montaje otra vez por un camino distinto, que es la forma de que
 * un día dejen de coincidir.
 */
import type { TimedEvent } from './playback';

/**
 * Pulsos de reloj por negra.
 *
 * Cuatrocientos ochenta porque es divisible por 2, 3, 4, 5, 6 y 8: la rejilla
 * del punteo son medias negras y los tresillos, si algún día los hay, caen
 * exactos. Es el valor que usa casi todo secuenciador.
 */
const PULSOS_POR_NEGRA = 480;

/** Un pulso de la aplicación es una negra: lo dice la rejilla del punteo. */
const TICKS = PULSOS_POR_NEGRA;

/** Lo fuerte que entra cada nota. Ni susurro ni tope, que se edita fuera. */
const VELOCIDAD = 80;

export interface OpcionesMidi {
  /** Lo que va dentro del fichero como nombre de la pista. */
  readonly nombre: string;
  readonly bpm: number;
  readonly beatsPerBar: number;
}

/**
 * Un número en la codificación de longitud variable del MIDI.
 *
 * Siete bits por byte y el más alto encendido mientras quede algo. Es el
 * formato de las esperas entre eventos, y es propio del MIDI: no hay nada en el
 * dominio que se le parezca.
 */
function variable(valor: number): number[] {
  const bytes = [valor & 0x7f];
  let resto = Math.floor(valor / 128);
  while (resto > 0) {
    bytes.unshift((resto & 0x7f) | 0x80);
    resto = Math.floor(resto / 128);
  }
  return bytes;
}

/** Cuatro bytes, el más significativo primero. */
function cuatro(valor: number): number[] {
  return [(valor >>> 24) & 0xff, (valor >>> 16) & 0xff, (valor >>> 8) & 0xff, valor & 0xff];
}

/** Las letras de una marca de bloque, que en MIDI son ASCII. */
function letras(texto: string): number[] {
  /* v8 ignore start -- recorrer un texto da letras, y una letra siempre tiene punto de código */
  return [...texto].map((letra) => letra.codePointAt(0) ?? 0);
  /* v8 ignore stop */
}

/**
 * El nombre, recortado a lo que cabe en un evento de texto.
 *
 * Ciento veintisiete bytes es donde la longitud deja de caber en un solo byte
 * de la codificación variable, y un nombre más largo que eso no es un nombre.
 * Se cuenta en bytes y no en letras: una `ñ` ocupa dos.
 */
function nombreCorto(nombre: string): number[] {
  const bytes = letras(nombre).filter((codigo) => codigo < 128);
  return bytes.slice(0, 127);
}

/** Un encendido o un apagado, ya colocado en el tiempo. */
interface Toque {
  readonly tick: number;
  readonly midi: number;
  readonly enciende: boolean;
}

/**
 * Los eventos del montaje, convertidos en encendidos y apagados ordenados.
 *
 * **Los apagados van antes que los encendidos en el mismo instante.** Dos
 * bloques seguidos con la misma nota —un `C` detrás de otro `C`— comparten el
 * tick de la frontera: encendiendo primero, el apagado del primero mata al
 * segundo y se pierde un acorde entero.
 */
function toques(eventos: readonly TimedEvent[]): Toque[] {
  const lista: Toque[] = [];
  for (const evento of eventos) {
    const empieza = Math.round(evento.startBeat * TICKS);
    // Al menos un tick de duración: una nota que empieza y acaba en el mismo
    // instante no la toca nadie, y redondeando puede pasar.
    const dura = Math.max(1, Math.round(evento.beats * TICKS));
    for (const midi of evento.midis) {
      lista.push({ tick: empieza, midi, enciende: true });
      lista.push({ tick: empieza + dura, midi, enciende: false });
    }
  }
  return lista.sort((uno, otro) =>
    uno.tick !== otro.tick ? uno.tick - otro.tick : Number(uno.enciende) - Number(otro.enciende),
  );
}

/**
 * El fichero MIDI de lo que suena.
 *
 * Entra lo que ya entrega `soundOf` —acordes y punteo contra el mismo reloj— y
 * sale el fichero entero, listo para descargar.
 */
export function ficheroMidi(
  eventos: readonly TimedEvent[],
  { nombre, bpm, beatsPerBar }: OpcionesMidi,
): Uint8Array {
  const pista: number[] = [];

  const meta = (tipo: number, datos: readonly number[]) => {
    pista.push(...variable(0), 0xff, tipo, ...variable(datos.length), ...datos);
  };

  meta(0x03, nombreCorto(nombre));

  // El tempo va en microsegundos por negra, que es como lo guarda el formato.
  const microsegundos = Math.round(60_000_000 / bpm);
  meta(0x51, [(microsegundos >>> 16) & 0xff, (microsegundos >>> 8) & 0xff, microsegundos & 0xff]);

  // El compás. El denominador va como potencia de dos —un 2 quiere decir
  // negra—, y los dos últimos son los valores de siempre: las 24 señales de
  // reloj por negra y las ocho fusas por negra que espera todo el mundo.
  meta(0x58, [beatsPerBar, 2, 24, 8]);

  let anterior = 0;
  for (const toque of toques(eventos)) {
    pista.push(...variable(toque.tick - anterior));
    pista.push(toque.enciende ? 0x90 : 0x80, toque.midi & 0x7f, toque.enciende ? VELOCIDAD : 0);
    anterior = toque.tick;
  }

  meta(0x2f, []);

  return Uint8Array.from([
    ...letras('MThd'),
    ...cuatro(6),
    0x00,
    0x00, // formato 0
    0x00,
    0x01, // una pista
    (PULSOS_POR_NEGRA >>> 8) & 0xff,
    PULSOS_POR_NEGRA & 0xff,
    ...letras('MTrk'),
    ...cuatro(pista.length),
    ...pista,
  ]);
}

/**
 * Un nombre de fichero que no muerda a ningún sistema.
 *
 * Sin acentos, sin espacios y sin lo que Windows no deja: la descarga acaba en
 * el disco de alguien, y un fichero que no se puede guardar no vale de nada.
 *
 * La extensión se pide porque la copia de la canción (`.caos.json`) sale del mismo
 * título, y cambiarle la de MIDI con una expresión era depender de cómo acaba esta.
 */
export function nombreDeFichero(titulo: string, extension = 'mid'): string {
  const limpio = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${limpio === '' ? 'cancion' : limpio}.${extension}`;
}
