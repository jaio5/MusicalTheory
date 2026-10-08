/**
 * Criterio 7: la melodía, que lo nuevo no choque con tu punteo.
 */
import type { StyleId } from '../../styles';
import {
  acordeEnPulso,
  acotar,
  compasDe,
  estiloOno,
  NADA,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';

/**
 * Las tensiones que cada estilo admite sobre un acorde, en semitonos sobre su
 * fundamental: la novena en casi todos, la séptima menor en el rock y el blues
 * —y la tercera menor sobre el mayor, que es la gracia del blues—, y en jazz y
 * bolero también la sexta y la séptima mayor.
 */
const TENSIONES: Readonly<Record<StyleId | 'ninguno', readonly number[]>> = {
  jazz: [2, 9, 10, 11],
  // El bolero canta la sexta, la novena y la séptima mayor como el jazz.
  bolero: [2, 9, 10, 11],
  blues: [2, 3, 10],
  // El funk, las del blues y además la oncena del 7sus4 y la trecena.
  funk: [2, 3, 5, 9, 10],
  rock: [2, 10],
  country: [2, 9, 10],
  reggae: [2, 10],
  metal: [2],
  pop: [2],
  folk: [2, 5],
  // Y sobre el V, además, las del frigio mayor (`SOBRE_EL_V_DEL_FLAMENCO`).
  flamenco: [2, 10],
  // El cine canta la cuarta aumentada del lidio y la séptima mayor.
  cine: [2, 6, 11],
  ninguno: [],
};

/**
 * Lo que se canta sobre el V mayor de un flamenco, además de lo de todos: **la
 * novena menor y la tercera menor**, el Fa y el Sol natural sobre el Mi de una
 * andaluza en La. Es el frigio mayor, y en ese acorde no es un choque sino la
 * cadencia misma. Solo ahí: sobre el VI o el VII de la bajada, el semitono de
 * encima choca como en cualquier otro sitio.
 */
const SOBRE_EL_V_DEL_FLAMENCO: readonly number[] = [1, 3];

/** Las tensiones que admite un acorde en concreto: las del estilo, y las del V flamenco. */
function tensionesDe(j: Juicio, acorde: Acorde): readonly number[] {
  const delEstilo = TENSIONES[estiloOno(j)];
  return j.estilo === 'flamenco' && acorde.degree === 'V'
    ? [...delEstilo, ...SOBRE_EL_V_DEL_FLAMENCO]
    : delEstilo;
}

/**
 * Lo que es una nota del punteo contra un acorde: suya, color o choque. El choque
 * se dice por el lado: **encima** de una nota del acorde es la novena menor —un
 * Mib sobre Re, un Do sobre el Si de un Sol7—, la que no se aguanta en ningún
 * pulso; **debajo** es la que se oye y aun así se canta —el Fa contra el Fa# de un
 * Re7 es su novena aumentada, la del blues—.
 */
type NotaContra = 'cabe' | 'color' | 'choca-encima' | 'choca-debajo';

function notaContra(nota: number, acorde: Acorde, tensiones: readonly number[]): NotaContra {
  const sobreLaFundamental = (nota - acorde.root + 12) % 12;
  if (acorde.notas.includes(nota) || tensiones.includes(sobreLaFundamental)) {
    return 'cabe';
  }
  // La novena no choca aunque roce la tercera de un menor: se canta a diario.
  if (sobreLaFundamental === 2) {
    return 'color';
  }
  const a = (distancia: number) =>
    acorde.notas.some((suya) => (nota - suya + 12) % 12 === distancia);
  return a(1) ? 'choca-encima' : a(11) ? 'choca-debajo' : 'color';
}

function choca(como: NotaContra): boolean {
  return como === 'choca-encima' || como === 'choca-debajo';
}

/** Los acordes de la salida que suenan entre dos pulsos. */
function acordesEntre(j: Juicio, desde: number, hasta: number): Acorde[] {
  return j.cancion.filter(
    (acorde) => acorde.inicio < hasta && acorde.inicio + acorde.beats > desde,
  );
}

/**
 * Si el punteo sigue cabiendo en lo que suena debajo.
 *
 * **El punteo es tuyo y no se mueve**: cada compás de notas suena donde sonaba tu
 * acorde, y debajo va lo que la salida ponga en ese tiempo. Antes se miraba solo
 * el acorde que la salida cambiaba en su sitio, y estirar se daba por bueno «porque
 * el punteo se estira con los acordes»: no se estira, lo tocas tú. A doble tiempo
 * la canción dura la mitad y **la otra mitad del punteo se queda sin acordes**; a
 * medio tiempo, la nota de tu segundo compás cae sobre tu primer acorde, que dura
 * el doble. Ahora se mira por pulsos: la nota fuerte contra el acorde que suena al
 * empezar su compás, y la débil contra todos los que suenan mientras dura el suyo.
 * Lo que sigue siendo tu acorde no se mira: no es cosa de la salida.
 *
 * **Las débiles también cuentan, con la mitad de peso.** Que una nota de paso no
 * sea del acorde es lo normal —eso no resta—, pero una que roza a medio tono una
 * nota del acorde se oye aunque caiga en el pulso flojo, y más si se sostiene: un
 * Fa sobre un Re7 pasaba con 82 puntos porque no caía en el fuerte.
 */
export function melodia(j: Juicio): Hecho & { readonly aplica: boolean } {
  const punteo = j.contexto.melodia;
  const hayNotas = punteo?.some((notas) => notas.length > 0) === true;
  const hayFuertes = punteo?.some((notas) => notas.some((nota) => nota.fuerte)) === true;
  // Al continuar el punteo es el tuyo y suena sobre tus acordes, que no cambian:
  // lo que se añade va detrás y no tiene punteo encima.
  if (!hayNotas || j.kind === 'continuar') {
    return { ...NADA, aplica: hayFuertes };
  }
  const otroAcorde = (acorde: Acorde, tuyo: Acorde) =>
    acorde.degree !== tuyo.degree || acorde.especie !== tuyo.especie;
  let fuertes = 0;
  let caben = 0;
  let choque: string | null = null;
  let choqueDebil: { readonly encima: boolean; readonly motivo: string } | null = null;
  let sinAcordes: { readonly fuerte: boolean; readonly compas: number } | null = null;
  for (const [i, tuyo] of j.original.entries()) {
    const notas = punteo![i] ?? [];
    const hasta = tuyo.inicio + tuyo.beats;
    const enElFuerte = acordeEnPulso(j.cancion, tuyo.inicio);
    const debajo = acordesEntre(j, tuyo.inicio, hasta).filter((acorde) => otroAcorde(acorde, tuyo));
    for (const nota of notas) {
      if (nota.fuerte) {
        if (enElFuerte === undefined) {
          // La primera fuerte que se queda sin nada es la que se cuenta.
          if (sinAcordes === null || !sinAcordes.fuerte) {
            sinAcordes = { fuerte: true, compas: compasDe(j, tuyo) };
          }
          continue;
        }
        if (!otroAcorde(enElFuerte, tuyo)) {
          continue;
        }
        const como = notaContra(nota.nota, enElFuerte, tensionesDe(j, enElFuerte));
        fuertes += 1;
        if (como === 'cabe') {
          caben += 1;
        }
        if (choca(como)) {
          choque ??= `En el ${compasDe(j, tuyo)}, una nota fuerte del punteo queda a medio tono de una del ${enElFuerte.degree}: choca de frente.`;
        }
        continue;
      }
      if (acordesEntre(j, tuyo.inicio, hasta).length === 0) {
        sinAcordes ??= { fuerte: false, compas: compasDe(j, tuyo) };
        continue;
      }
      // Una débil no se sabe en qué pulso cae, así que choca si choca con algo nuevo
      // de lo que suena mientras dura. Que no sea del acorde no dice nada: es una
      // nota de paso, lo normal.
      const comos = debajo.map((acorde) => notaContra(nota.nota, acorde, tensionesDe(j, acorde)));
      const peor = comos.includes('choca-encima')
        ? 'choca-encima'
        : comos.includes('choca-debajo')
          ? 'choca-debajo'
          : null;
      if (peor !== null && (choqueDebil === null || peor === 'choca-encima')) {
        const contra = debajo[comos.indexOf(peor)]!;
        const donde = peor === 'choca-encima' ? 'medio tono por encima' : 'medio tono por debajo';
        choqueDebil = {
          encima: peor === 'choca-encima',
          motivo: `En el ${compasDe(j, tuyo)}, una nota débil del punteo queda ${donde} de una del ${contra.degree}: se oye aunque no caiga en el fuerte.`,
        };
      }
    }
  }
  // Lo que no tiene acordes debajo no se acompaña: la canción se ha acabado antes
  // que tu punteo. Si es una nota fuerte, no es una versión de tu canción.
  if (sinAcordes !== null) {
    const motivo = `Tu punteo sigue en el compás ${sinAcordes.compas} y la canción ya se ha acabado: se queda sin acordes debajo.`;
    return sinAcordes.fuerte
      ? { valor: -1, motivo, aplica: true, descarte: 'deja el punteo sin acordes debajo' }
      : { valor: -1, motivo, aplica: true };
  }
  // **Una sola nota fuerte que choca de frente basta**: medio tono contra una nota
  // del acorde, en el pulso que más se oye, no es un color sino una disonancia
  // que nadie ha pedido. Antes hacían falta tres, y un Fa sobre el Re7 de un
  // punteo de una nota por compás pasaba siempre.
  if (choque !== null) {
    return { valor: -1, motivo: choque, aplica: true, descarte: 'choca con el punteo' };
  }
  // La débil que choca no descarta —pasa por debajo del pulso—, pero resta entera:
  // es lo que se oye de esa salida. Y si es la novena menor, además tiene reparo:
  // solo entra si no hay tres salidas sin ella.
  if (choqueDebil !== null) {
    return {
      valor: -1,
      motivo: choqueDebil.motivo,
      aplica: true,
      ...(choqueDebil.encima ? { reparo: 'una nota débil del punteo choca' } : {}),
    };
  }
  // Sin notas fuertes debajo de algo nuevo no hay nada que medir; y si tu punteo
  // solo tiene débiles y ninguna choca, no cuenta en los puntos.
  if (fuertes === 0) {
    return { ...NADA, aplica: hayFuertes };
  }
  // Lo que no cabe sin chocar —una sexta, una cuarta lejos de la tercera— resta, y
  // si es casi todo el punteo fuerte, la salida tiene un reparo: no suena mal, pero
  // tu punteo ya no se apoya en sus acordes.
  const fraccion = caben / fuertes;
  return {
    valor: acotar(2 * fraccion - 1),
    motivo:
      fuertes === 1
        ? `La nota fuerte del punteo ${caben === 1 ? 'cabe' : 'no cabe'} en el acorde cambiado.`
        : `${caben} de ${fuertes} notas fuertes del punteo caben en los acordes cambiados.`,
    aplica: true,
    ...(fuertes >= 3 && fraccion < 1 / 3 ? { reparo: 'no cabe en el punteo' } : {}),
  };
}
