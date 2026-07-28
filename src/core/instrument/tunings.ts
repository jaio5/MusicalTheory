/**
 * Otras afinaciones.
 *
 * Se guardan como notas al aire y nada más: todo lo que hace falta para afinar
 * —qué cuerda está más cerca, cuántos cents sobra— sale de ahí. El nombre de
 * cada cuerda se calcula, que es la única forma de que una afinación nueva no
 * traiga su propia lista de etiquetas que se pueda desincronizar.
 */

import { midiToPitchClass, noteName } from '../music/notes';

import { STANDARD_TUNING, type GuitarString } from './guitar';

export type TuningId =
  'standard' | 'dropD' | 'halfStepDown' | 'fullStepDown' | 'dropC' | 'dadgad' | 'openG' | 'openD';

export interface Tuning {
  readonly id: TuningId;
  readonly name: string;
  /** Para qué sirve, en una frase de guitarrista. */
  readonly summary: string;
  /** Las seis cuerdas, de la sexta a la primera. */
  readonly strings: readonly GuitarString[];
}

const NUMBERS: readonly GuitarString['number'][] = [6, 5, 4, 3, 2, 1];

/**
 * Convierte seis notas MIDI en cuerdas con nombre. Las dos Es de la afinación
 * estándar se distinguen por grave y aguda, porque decir «E» dos veces al
 * afinar no ayuda a nadie.
 */
function stringsFrom(midis: readonly number[]): readonly GuitarString[] {
  const names = midis.map((midi) => noteName(midiToPitchClass(midi)));
  return midis.map((midi, index) => {
    const name = names[index]!;
    const repeated = names.filter((other) => other === name).length > 1;
    const suffix = repeated ? (names.indexOf(name) === index ? ' grave' : ' agudo') : '';
    return { number: NUMBERS[index]!, midi, label: `${name}${suffix}` };
  });
}

export const TUNINGS: Readonly<Record<TuningId, Tuning>> = {
  standard: {
    id: 'standard',
    name: 'Estándar',
    summary: 'E A D G B E. La de siempre.',
    strings: STANDARD_TUNING,
  },
  dropD: {
    id: 'dropD',
    name: 'Drop D',
    summary: 'Baja la sexta un tono: la quinta con un dedo.',
    strings: stringsFrom([38, 45, 50, 55, 59, 64]),
  },
  halfStepDown: {
    id: 'halfStepDown',
    name: 'Medio tono abajo',
    summary: 'Todo un semitono más grave. Suena más gordo y canta más fácil.',
    strings: stringsFrom([39, 44, 49, 54, 58, 63]),
  },
  fullStepDown: {
    id: 'fullStepDown',
    name: 'Un tono abajo',
    summary: 'D G C F A D. Terreno de stoner y doom.',
    strings: stringsFrom([38, 43, 48, 53, 57, 62]),
  },
  dropC: {
    id: 'dropC',
    name: 'Drop C',
    summary: 'Un tono abajo y la sexta otro más. Riffs pesados.',
    strings: stringsFrom([36, 43, 48, 53, 57, 62]),
  },
  dadgad: {
    id: 'dadgad',
    name: 'DADGAD',
    summary: 'Suena a modal sin tocar nada. Folk y celta.',
    strings: stringsFrom([38, 45, 50, 55, 57, 62]),
  },
  openG: {
    id: 'openG',
    name: 'Open G',
    summary: 'Al aire ya suena G. El slide de los Stones.',
    strings: stringsFrom([38, 43, 50, 55, 59, 62]),
  },
  openD: {
    id: 'openD',
    name: 'Open D',
    summary: 'Al aire ya suena D. Slide y blues antiguo.',
    strings: stringsFrom([38, 45, 50, 54, 57, 62]),
  },
};

export const TUNING_IDS: readonly TuningId[] = Object.keys(TUNINGS) as TuningId[];
