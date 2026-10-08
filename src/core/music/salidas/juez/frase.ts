/**
 * Criterio 3: la frase, que lo que se añade mida lo que mide lo tuyo.
 */
import { cifra } from '../../../cifras';
import type { Final, Hecho, Juicio } from './juicio';
import { pulsosHabituales } from './ritmo-armonico';

export function frase(j: Juicio, final: Final | null, blues: boolean): Hecho {
  const { largoOriginal } = j;
  // Una tónica final sostenida no alarga la frase: es la llegada que se queda
  // sonando. `ii V I I` con el último el doble siguen siendo cuatro compases.
  const ultimo = j.cancion[j.cancion.length - 1]!;
  const habitual = pulsosHabituales(j.original, j.pc);
  // Un blues se cuenta de doce en doce; lo demás, de cuatro en cuatro o del largo
  // de tus frases, si son otro a propósito (`fraseDe`).
  const grupo = blues ? 12 : j.frase;
  const deCuantas = grupo === 4 ? 'de cuatro en cuatro' : `de ${grupo} en ${grupo}, como las tuyas`;
  const sostenida =
    final !== null && ultimo.beats > habitual ? (ultimo.inicio + habitual) / j.pc : j.largo;
  // Contar la llegada sostenida como un compás solo vale si eso da compases: una
  // tónica de dos pulsos tras acordes de uno no deja la frase a mitad de compás.
  const largo = j.largo % grupo === 0 || !Number.isInteger(sostenida) ? j.largo : sostenida;
  // Dicho como es: si la tónica sostenida no se cuenta, la canción dura más que la frase.
  const cuantos =
    largo === j.largo ? `${largo} compases` : `${largo} compases y la llegada sostenida`;
  // Continuar y otro final deciden el largo; rearmonizar no lo toca, y estirar lo
  // dobla o lo parte a propósito. Pero un estirar que no da ni el doble ni la
  // mitad de lo tuyo —un acorde largo que no se estira con los demás— también lo
  // ha decidido, y lo ha dejado cojo.
  const proporcionado = j.largo === 2 * largoOriginal || 2 * j.largo === largoOriginal;
  const decideElLargo =
    j.kind === 'continuar' || j.path === 'otro-final' || (j.path === 'estirar' && !proporcionado);
  const coja = (motivo: string, descarte: string): Hecho =>
    decideElLargo ? { valor: -1, motivo, descarte } : { valor: -1, motivo };
  if (j.largo === largoOriginal && largo % grupo !== 0) {
    return {
      valor: 0,
      motivo:
        largoOriginal === 1 ? 'Mantiene tu compás.' : `Mantiene tus ${largoOriginal} compases.`,
    };
  }
  if (!Number.isInteger(largo)) {
    return coja(
      `Acaba a mitad de compás: ${cifra(largo, 1)} compases.`,
      'la frase acaba a mitad de compás',
    );
  }
  if (largo % grupo === 0) {
    return {
      valor: 1,
      motivo: blues
        ? `${cuantos}: la forma de doce del blues, entera.`
        : `${cuantos}: la frase se cuenta ${deCuantas}.`,
    };
  }
  if (
    final !== null &&
    final.compas > 0 &&
    final.compas % grupo === 0 &&
    largo - final.compas <= 2
  ) {
    return {
      valor: 0.7,
      motivo: `${cuantos}: la tónica cae en el ${final.compas + 1}, el compás fuerte que abre el grupo siguiente.`,
    };
  }
  if (blues) {
    return { valor: -0.6, motivo: `${cuantos}: rompe la forma de doce del blues.` };
  }
  // Tus frases son de otro largo, y esta no lo respeta: cuadrar a cuatro una forma
  // de tres en tres es romperla, aunque ocho «cuadre».
  if (grupo !== 4) {
    return coja(
      `${cuantos}: rompe tus frases de ${grupo}.`,
      `rompe tus frases de ${grupo} compases`,
    );
  }
  if (4 % largo === 0) {
    return {
      valor: 0.2,
      motivo: `Una vuelta de ${largo === 1 ? 'un compás' : `${largo} compases`}, que cabe en la frase de cuatro.`,
    };
  }
  if (largoOriginal >= 4 && largo % largoOriginal === 0) {
    return { valor: 0.8, motivo: `${cuantos}: tu frase de ${largoOriginal}, repetida.` };
  }
  if (largo % 2 === 0) {
    return { valor: -0.5, motivo: `${cuantos}: la frase no cuadra de cuatro en cuatro.` };
  }
  return coja(`${cuantos}: la frase queda coja.`, `una frase coja de ${largo} compases`);
}
