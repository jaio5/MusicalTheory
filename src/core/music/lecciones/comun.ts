/**
 * Lo que comparten todas las lecciones al escribirse.
 *
 * Vivía dentro de `lessons.ts` cuando eran diez. Con el temario del
 * conservatorio son veintidós y se reparten en ficheros por asignatura, y cada
 * uno necesita lo mismo: la escala de la tonalidad, contar semitonos, la
 * dominante de verdad en menor y escribir las opciones con la buena delante.
 */

import { chordSymbol } from '../chords';
import { accidentalForKey, keySignature } from '../circle-of-fifths';
import { keyName, type KeyMode } from '../keys';
import type { Choice } from '../lessons';
import { normalizePitchClass, type PitchClass } from '../notes';
import { SCALES, type HeptatonicScaleId } from '../scales';
import { keyTonic, spellScale, spelledName } from '../spelling';

/** La escala de siete notas de la que salen los acordes de esa tonalidad. */
export function scaleOf(mode: KeyMode): HeptatonicScaleId {
  return mode === 'major' ? 'major' : 'naturalMinor';
}

export function up(tonic: PitchClass, semitones: number): PitchClass {
  return normalizePitchClass(tonic + semitones);
}

/**
 * La dominante de la tonalidad, que **en menor no es el quinto grado**.
 *
 * En mayor el V ya es mayor y con la séptima de la escala da la dominante —G7 en
 * Do—. En el menor **natural** el quinto grado es menor, así que su cuatríada es
 * un `m7` sin tritono dentro: ni aprieta, ni pide resolver, ni es una dominante.
 * La que se usa se trae del menor armónico, que sube la séptima para tener
 * sensible, y es mayor.
 *
 * Existe porque cuatro lecciones daban por hecho lo contrario y decían, en las
 * doce tonalidades menores, que `Em7` tiene la tercera mayor, que lleva el
 * tritono y que el sustituto tritonal aprieta igual que él.
 */
export function dominanteDe(
  tonic: PitchClass,
  mode: KeyMode,
): { triada: string; cuatriada: string } {
  const triada = chordSymbol(up(tonic, 7), 'major', accidentalForKey(tonic, mode));
  return { triada, cuatriada: `${triada}7` };
}

/**
 * La homónima —la misma tónica en el otro modo—, escrita con la letra de la tónica.
 *
 * Con `keyName`, que escribe cada tonalidad como la rueda, la homónima de Db
 * mayor salía «C# menor», y tres lecciones decían entonces que «C# menor tiene la
 * misma tónica» que Db mayor: suena igual, pero quien aprende lee otra letra, y
 * distinguir dos notas que suenan igual es justo lo que se le está enseñando. Se
 * escribe con la letra de la tónica aunque sea una tonalidad teórica —Db menor,
 * con ocho bemoles— y, cuando la rueda la escribe con menos alteraciones, la
 * aclaración lo dice.
 */
export function homonima(tonic: PitchClass, mode: KeyMode): { nombre: string; aclaracion: string } {
  const otro: KeyMode = mode === 'major' ? 'minor' : 'major';
  const tonica = keyTonic(tonic, mode);
  const nombre = `${spelledName(tonica)} ${otro === 'major' ? 'mayor' : 'menor'}`;
  const conSuLetra = spellScale(tonica, SCALES[scaleOf(otro)].intervals).reduce(
    (total, nota) => total + Math.abs(nota.alter),
    0,
  );
  const enLaRueda = keyName(tonic, otro);
  return {
    nombre,
    aclaracion:
      keySignature(tonic, otro).letters.length < conSuLetra
        ? ` En la práctica se escribe ${enLaRueda}, que suena igual y lleva menos alteraciones.`
        : '',
  };
}

/**
 * Las opciones de un ejercicio, con la buena escrita primero.
 *
 * Primero **al escribirlas**, que es como se leen bien las cien que hay en este
 * fichero: la respuesta al lado de la pregunta. En qué orden se enseñan lo decide
 * `lessonNotes` al salir, porque durante un tiempo salieron en este mismo orden y
 * la buena era siempre la de la izquierda: se aprobaba el temario sin leer.
 */
export function choices(correct: string, wrong: readonly string[]): readonly Choice[] {
  return [{ text: correct, correct: true }, ...wrong.map((text) => ({ text, correct: false }))];
}
