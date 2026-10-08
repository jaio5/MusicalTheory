/**
 * El camino `estirar`: los mismos grados con otros pulsos.
 *
 * No cambia ni un grado, y por eso es el único camino que sirve para cuadrar una
 * toma desigual.
 */
import { retoque, type Borrador } from './borrador';
import { tuyo } from './especies';
import type { Idioma } from './idioma';
import type { PathStep } from './tipos';
import { MAX_BEATS, MAX_PATH_STEPS, pulsosDe } from './validar';

/**
 * Estirar: cuadrar lo grabado, a medio tiempo, a doble tiempo, y el último o el
 * primero el doble **si eso cuadra la frase**.
 *
 * Lo grabado desigual se cuadra antes de doblarlo o partirlo: a medio tiempo
 * heredaba el accidente de la toma —cinco y tres pasaban a diez y seis—. Y a doble
 * tiempo no deja compases de un pulso, que no son un compás sino un golpe.
 *
 * **Lo que dice cada una es lo que hace**: «el doble de largo» solo si cada acorde
 * dura el doble que en tu toma —con una toma desigual dura otra cosa, y se dice
 * cuánto—, y «cuadra lo que se tocó desigual» solo si se tocó desigual.
 */
export function estiramientos(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const habitual = id.pulsos;
  const ultimo = original.length - 1;
  // La llegada sostenida no es un accidente de la toma: `I I7 IV iv I:8` acaba con
  // la tónica dos compases a propósito. Desigual es lo demás que no va a tu paso.
  const sostieneLaLlegada = (paso: PathStep, i: number) =>
    i === ultimo && paso.degree === id.tonica && paso.beats % habitual === 0;
  const desigual = original.some(
    (paso, i) => paso.beats !== habitual && !sostieneLaLlegada(paso, i),
  );
  const conPulsos = (pulsos: (paso: PathStep, i: number) => number) =>
    retoque(original.map((paso, i) => ({ ...tuyo(id, original, i), beats: pulsos(paso, i) })));
  const total = pulsosDe(original);
  const cuadraLaFrase = (extra: number) =>
    total % id.frase !== 0 && (total + extra) % id.frase === 0;
  // «Cuadra» es una promesa sobre el largo: solo se dice si lo que queda mide
  // frases enteras. Cuadrar a 4 pulsos `5 3 4 4 4` deja cinco compases, y eso no
  // cuadra nada aunque todos duren lo mismo.
  const enFrases = (cuantos: number, pulsos: number) => (cuantos * pulsos) % id.frase === 0;
  // Y ninguna sale del tope de compases de una canción (`MAX_PATH_STEPS`): treinta y
  // dos compases a medio tiempo son sesenta y cuatro, y eso ya no es tu canción
  // tocada más despacio, es una forma que no cabe en ninguna.
  const cabe = (pulsos: number) => pulsos <= MAX_PATH_STEPS * id.compas;
  const borradores: Borrador[] = [];

  if (desigual) {
    const cuadra = enFrases(original.length, habitual);
    borradores.push({
      path: 'estirar',
      partes: conPulsos(() => habitual),
      nombre: `Cuadrada a ${habitual} pulsos`,
      que: cuadra
        ? `Los mismos acordes, cada compás a ${habitual} pulsos: cuadra lo que se tocó desigual.`
        : `Los mismos acordes, cada compás a ${habitual} pulsos: iguala lo que se tocó desigual.`,
      ...(cuadra ? { cuadra: true as const } : {}),
      prioridad: 9,
      familia: 'cuadrar',
    });
  }
  // Con una toma regular cada acorde dura el doble que en la tuya —la llegada
  // sostenida también—; con una desigual, todos lo mismo.
  const doble = (paso: PathStep) => (desigual ? habitual * 2 : paso.beats * 2);
  if (
    original.every((paso) => doble(paso) <= MAX_BEATS) &&
    cabe(pulsosDe(original.map((paso) => ({ ...paso, beats: doble(paso) }))))
  ) {
    const cuadra = desigual && enFrases(original.length, habitual * 2);
    borradores.push({
      path: 'estirar',
      partes: conPulsos(doble),
      nombre: 'A medio tiempo',
      que: desigual
        ? `Los mismos acordes, todos a ${habitual * 2} pulsos: ${cuadra ? 'cuadra' : 'iguala'} lo que se tocó desigual y la canción respira.`
        : 'Los mismos acordes, cada uno el doble de largo: la canción respira.',
      ...(cuadra ? { cuadra: true as const } : {}),
      prioridad: 4.5,
      familia: 'medio-tiempo',
    });
  }
  // Y que quede una frase: una idea de dos compases a doble tiempo cabe en uno, y
  // eso es un golpe de riff, no una manera de tocar tu canción.
  const mitad = habitual / 2;
  const partido = (paso: PathStep) => (desigual ? mitad : paso.beats / 2);
  // Con el habitual par se parte entero, y la llegada sostenida también: dura un
  // múltiplo suyo.
  if (original.length * mitad >= 2 * id.compas && habitual % 2 === 0 && habitual >= 4) {
    const cuadra = desigual && enFrases(original.length, mitad);
    borradores.push({
      path: 'estirar',
      partes: conPulsos(partido),
      nombre: 'A doble tiempo',
      que: desigual
        ? `Los mismos acordes, todos a ${mitad} pulsos: ${cuadra ? 'cuadra' : 'iguala'} lo que se tocó desigual y la armonía corre el doble.`
        : 'Los mismos acordes, cada uno la mitad de largo: la armonía corre el doble.',
      ...(cuadra ? { cuadra: true as const } : {}),
      prioridad: 4,
      familia: 'doble-tiempo',
    });
  }
  // Solo si lo último es la llegada: sostener un acorde abierto no cuadra nada, lo
  // deja colgando un compás más.
  const finalDoble = original[ultimo]!.beats;
  if (
    original[ultimo]!.degree === id.tonica &&
    finalDoble * 2 <= MAX_BEATS &&
    cuadraLaFrase(finalDoble) &&
    cabe(total + finalDoble)
  ) {
    borradores.push({
      path: 'estirar',
      partes: conPulsos((paso, i) => (i === ultimo ? paso.beats * 2 : paso.beats)),
      nombre: 'El último, el doble',
      que: `El último compás, ${original[ultimo]!.degree}, dura el doble: la llegada se sostiene y la frase cuadra.`,
      prioridad: 6,
      familia: 'el-ultimo',
    });
  }
  const primeroDoble = original[0]!.beats;
  if (
    original.length > 1 &&
    primeroDoble * 2 <= MAX_BEATS &&
    cuadraLaFrase(primeroDoble) &&
    cabe(total + primeroDoble)
  ) {
    borradores.push({
      path: 'estirar',
      partes: conPulsos((paso, i) => (i === 0 ? paso.beats * 2 : paso.beats)),
      nombre: 'El primero, el doble',
      que: `El primer compás, ${original[0]!.degree}, dura el doble: tarda más en arrancar y la frase cuadra.`,
      prioridad: 4.5,
      familia: 'el-primero',
    });
  }
  return [...borradores, ...unAcordeEstirado(id, original)];
}

/**
 * Un acorde solo, estirado hasta llenar una frase o recogido en un compás.
 *
 * Con un acorde no hay nada que rearmonizar —el único compás dice la tonalidad—,
 * pero sí cuánto dura: lo que se toca para buscar una canción suele ser eso, un
 * acorde sonando, y lo primero que se le pide es que dure una frase.
 */
function unAcordeEstirado(id: Idioma, original: readonly PathStep[]): Borrador[] {
  if (original.length !== 1) {
    return [];
  }
  const { degree, beats } = original[0]!;
  const borradores: Borrador[] = [];
  if (id.frase > beats * 2 && id.frase <= MAX_BEATS) {
    borradores.push({
      path: 'estirar',
      partes: retoque([{ ...tuyo(id, original, 0), beats: id.frase }]),
      nombre: 'Una frase entera',
      que: `El ${degree} dura ${id.frase / id.compas} compases, una frase entera: de ahí puede salir la canción.`,
      prioridad: 5,
      familia: 'la-frase',
    });
  }
  if (beats > id.compas && beats % id.compas === 0 && beats / 2 !== id.compas) {
    borradores.push({
      path: 'estirar',
      partes: retoque([{ ...tuyo(id, original, 0), beats: id.compas }]),
      nombre: 'En un compás',
      que: `El ${degree} dura un compás y no ${beats / id.compas}: lo mismo, sin esperar.`,
      prioridad: 3.5,
      familia: 'un-compas',
    });
  }
  return borradores;
}
