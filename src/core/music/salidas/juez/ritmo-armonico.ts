/**
 * Criterio 4: el ritmo armónico, cada cuánto cambia el acorde.
 */
import { cifraCorta, enPulsos } from '../../../cifras';
import {
  compasDe,
  juntar,
  pulsos,
  rejillaDelCompas,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';

/**
 * Lo que dura un acorde de lo tuyo **de costumbre**: lo que más se repite, o la
 * media si empatan. Es lo que dura cada acorde que se añade, y la vara con la que
 * el juez mide el paso de la armonía: **la misma en los dos sitios** —por eso se
 * exporta y `idioma.ts` no tiene la suya—, o lo que allí cuadra aquí saldría cojo.
 *
 * Una toma de 5, 3, 6 y 2 pulsos es un compás de cuatro tocado desigual, y la
 * media lo dice. **Y lo que sale se lleva a la rejilla del compás**: antes una toma
 * con dos acordes de un pulso entre otros de seis decía que lo de costumbre era un
 * pulso, y cada compás nuevo salía de un golpe —o no salía ninguno, porque una
 * frase de dieciséis golpes no cabe en treinta y dos compases—. Si lo de costumbre
 * no cae en la rejilla, vale el de la rejilla más cercano a la media: lo tocado
 * desigual se cuadra, no se copia.
 */
export function pulsosHabituales(
  pasos: readonly { readonly beats: number }[],
  pulsosPorCompas: number,
): number {
  const cuenta = new Map<number, number>();
  for (const paso of pasos) {
    cuenta.set(paso.beats, (cuenta.get(paso.beats) ?? 0) + 1);
  }
  const maximo = Math.max(...cuenta.values());
  const ganadores = [...cuenta].filter(([, veces]) => veces === maximo);
  const media = pulsos(pasos) / Math.max(1, pasos.length);
  const crudo = ganadores.length === 1 ? ganadores[0]![0] : Math.round(media);
  const rejilla = rejillaDelCompas(pulsosPorCompas);
  if (rejilla.includes(crudo)) {
    return crudo;
  }
  // Un riff a golpes —todo más corto que medio compás y en su sitio— va a golpes
  // de verdad: lo que se añada, también. Dos golpes sueltos entre acordes largos
  // no lo son, y esos se cuadran como cualquier toma desigual.
  const medio = rejilla[0]!;
  let inicio = 0;
  const aGolpes = pasos.every((paso) => {
    const enSuSitio = { beats: paso.beats, inicio };
    inicio += paso.beats;
    return vaAGolpes(enSuSitio, medio) || (paso.beats === medio && enSuSitio.inicio % medio === 0);
  });
  if (aGolpes && crudo < medio) {
    return crudo;
  }
  // El más cercano a la media; a igual distancia, el más largo, que es el que no
  // deja golpes sueltos.
  return rejilla.reduce((mejor, b) => (Math.abs(b - media) <= Math.abs(mejor - media) ? b : mejor));
}

/**
 * Si un acorde corto va **a golpes**: dura una fracción exacta de la mitad del
 * compás y cae en su sitio. Un riff a un pulso por acorde es un ritmo armónico
 * tan regular como uno a cuatro; lo desigual es mezclar duraciones que no caben
 * en la rejilla —cinco y tres—, no que sean cortas.
 */
function vaAGolpes(paso: { readonly beats: number; readonly inicio: number }, unidad: number) {
  return paso.beats < unidad && unidad % paso.beats === 0 && paso.inicio % paso.beats === 0;
}

/**
 * Si la salida cuadra una toma desigual; `null` si tu toma ya iba a tiempo.
 *
 * Una toma de 5, 3, 6 y 2 pulsos es un compás de cuatro tocado desigual: lo que
 * se construya encima hereda el tropiezo, y lo que la cuadra lo arregla. Cuadrar
 * es que todo empiece a tiempo y dure lo mismo, o compases enteros: estirar esa
 * toma al doble da 10, 6, 12 y 4, que caen a tiempo y siguen siendo desiguales.
 */
export function cuadraLaToma(j: Juicio): boolean | null {
  const unidad = j.pc % 2 === 0 ? j.pc / 2 : j.pc;
  const aTiempo = (paso: Acorde) => paso.inicio % unidad === 0 && paso.beats % unidad === 0;
  if (j.original.every((paso) => aTiempo(paso) || vaAGolpes(paso, unidad))) {
    return null;
  }
  const iguales = new Set(j.cancion.map((paso) => paso.beats)).size === 1;
  return (
    j.cancion.every(aTiempo) && (iguales || j.cancion.every((paso) => paso.beats % j.pc === 0))
  );
}

export function ritmoArmonico(j: Juicio): Hecho {
  const habitual = pulsosHabituales(j.original, j.pc);
  const unidad = j.pc % 2 === 0 ? j.pc / 2 : j.pc;
  const tuyos = new Set(j.original.map((paso) => paso.beats));
  // Estirar lo cambia todo a la vez y a propósito; al continuar, un compás de
  // otro largo es la canción cambiando de paso a mitad.
  const uniforme = j.path === 'estirar';
  const ultimo = j.cancion.length - 1;

  const cuadra = cuadraLaToma(j);
  if (cuadra !== null) {
    return cuadra
      ? { valor: 1, motivo: 'Cuadra tu toma: cada acorde dura lo mismo, o compases enteros.' }
      : { valor: -1, motivo: 'Tu toma va desigual y esta salida no la cuadra.' };
  }

  // Un acorde cambiado en su sitio no cambia el paso: solo se mira lo que dura
  // otra cosa o empieza en otro pulso.
  const mira = [...j.nuevos].filter((i) => {
    const antes = j.original[i];
    const paso = j.cancion[i]!;
    return j.kind === 'continuar' || antes?.beats !== paso.beats || antes.inicio !== paso.inicio;
  });
  // Más del doble que el más largo de lo tuyo no es otro paso: es relleno, un
  // acorde que se queda sonando compases enteros para cuadrar y no propone nada.
  // Mantener la llegada el doble sí es música; cuatro veces, tiempo muerto.
  const tope = 2 * Math.max(...j.original.map((paso) => paso.beats));
  const hechos = mira.map((i): Hecho => {
    const paso = j.cancion[i]!;
    const b = paso.beats;
    if (b > tope) {
      return {
        valor: -1,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)}, más del doble que el más largo de lo tuyo: rellena.`,
        reparo: 'rellena: un acorde que dura más del doble que los tuyos',
      };
    }
    // Primero el de un pulso: es el que deja a destiempo a todos los de detrás.
    if (b === 1 && !tuyos.has(1)) {
      return {
        valor: -1,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura un pulso, y lo tuyo no tenía ninguno así.`,
      };
    }
    if (paso.inicio % unidad !== 0 && !vaAGolpes(paso, unidad)) {
      return {
        valor: -0.8,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} cambia de acorde a destiempo del compás.`,
      };
    }
    if (b === habitual) {
      return {
        valor: 1,
        motivo: `Los acordes nuevos duran ${enPulsos(b)}, como los tuyos.`,
      };
    }
    if (i === ultimo && paso.funcion === 'tonica' && b % habitual === 0) {
      return { valor: 1, motivo: `La tónica final dura ${enPulsos(b)}: la llegada se sostiene.` };
    }
    if (b % unidad !== 0) {
      return {
        valor: -0.5,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)}: no cuadra con el compás.`,
      };
    }
    // Un riff a golpes que ya mezcla uno y dos pulsos no cambia de paso por
    // repetir una de sus duraciones: es su ritmo.
    if (!uniforme && b < j.pc && tuyos.has(b)) {
      return {
        valor: 0.6,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)}, como algunos tuyos.`,
      };
    }
    // El reggae cambia cada compás o cada medio compás: el vaivén a dos pulsos es
    // su paso, no otro.
    if (!uniforme && j.estilo === 'reggae' && 2 * b === j.pc && habitual === j.pc) {
      return {
        valor: 0.4,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura medio compás: el vaivén del reggae.`,
      };
    }
    if (!uniforme) {
      return {
        valor: -0.5,
        motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)} donde tú tenías ${cifraCorta(habitual)}: cambia el paso de la armonía.`,
      };
    }
    if (b < habitual) {
      if (b >= j.pc) {
        return {
          valor: 0.4,
          motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)}, un compás entero.`,
        };
      }
      return [...tuyos].some((tuyo) => tuyo <= b)
        ? {
            valor: 0.3,
            motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)}, como algunos tuyos.`,
          }
        : {
            valor: -0.6,
            motivo: `El ${paso.degree} del ${compasDe(j, paso)} dura ${enPulsos(b)} donde tú tenías ${cifraCorta(habitual)}: corre más que lo tuyo.`,
          };
    }
    return b === habitual * 2
      ? { valor: 0.3, motivo: `Todo dura el doble: ${enPulsos(b)} por acorde.` }
      : {
          valor: 0.1,
          motivo: `El ${paso.degree} del ${compasDe(j, paso)} pasa a durar ${enPulsos(b)}.`,
        };
  });
  return juntar(hechos.map((hecho) => ({ hecho, peso: 1 })));
}
