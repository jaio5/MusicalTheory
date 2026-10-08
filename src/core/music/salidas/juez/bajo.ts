/**
 * Criterio 5: el bajo, que no salte sin motivo.
 */
import {
  enlaceDeVuelta,
  enlacesNuevos,
  esDudoso,
  juntar,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';

/**
 * Lo que vale cada salto del bajo, en semitonos hacia arriba.
 *
 * Bajar una quinta es lo más fuerte que hay (V I) y subir un tono es el
 * escalón que empuja (IV V, bVII I). Bajar una tercera es suave —comparten dos
 * notas— y subirla es débil: es lo que hace `vi I`, llegar de rebote. El tritono
 * es el salto más raro. Los dos semitonos se deciden aparte, porque dependen de
 * quién baja: el sustituto tritonal lo hace a propósito.
 */
const SALTO_DEL_BAJO: Readonly<Record<number, { valor: number; nombre: string }>> = {
  0: { valor: 0.2, nombre: 'se queda en la misma nota' },
  2: { valor: 0.7, nombre: 'sube un tono' },
  3: { valor: 0, nombre: 'sube una tercera, el salto débil' },
  4: { valor: 0, nombre: 'sube una tercera, el salto débil' },
  5: { valor: 1, nombre: 'baja una quinta, el enlace más fuerte' },
  6: { valor: -0.6, nombre: 'salta una cuarta aumentada' },
  7: { valor: 0.5, nombre: 'sube una quinta' },
  8: { valor: 0.5, nombre: 'baja una tercera, suave' },
  9: { valor: 0.5, nombre: 'baja una tercera, suave' },
  10: { valor: 0.4, nombre: 'baja un tono' },
};

function saltoDelBajo(a: Acorde, b: Acorde): Hecho {
  const salto = (b.root - a.root + 12) % 12;
  const de = `${a.degree} ${b.degree}`;
  if (salto === 11) {
    if (a.funcion === 'tritono') {
      return { valor: 0.8, motivo: `${de}: el bajo baja medio tono hasta lo que preparaba.` };
    }
    if (b.funcion === 'tritono') {
      return {
        valor: 0.6,
        motivo: `${de}: el bajo baja por semitonos hacia el sustituto tritonal.`,
      };
    }
    // VI V, la bajada frigia de la andaluza, también llega a algo. Y una secundaria
    // es una dominante, la de otro grado: Fa Mi7 en Do baja a la del vi.
    if (b.funcion === 'dominante') {
      return { valor: 0.4, motivo: `${de}: el bajo baja medio tono hasta la dominante.` };
    }
    if (b.funcion === 'secundaria') {
      return {
        valor: 0.4,
        motivo: `${de}: el bajo baja medio tono hasta una dominante secundaria.`,
      };
    }
    if (b.funcion === 'tonica') {
      return { valor: 0.4, motivo: `${de}: el bajo baja medio tono hasta la tónica.` };
    }
    return { valor: -0.4, motivo: `${de}: el bajo baja medio tono sin ir a ningún sitio.` };
  }
  if (salto === 1) {
    return a.funcion === 'dominante' && (b.funcion === 'tonica' || b.funcion === 'sustituto')
      ? { valor: 0.4, motivo: `${de}: el bajo sube medio tono, como una sensible.` }
      : { valor: -0.4, motivo: `${de}: el bajo sube medio tono sin resolver nada.` };
  }
  const { valor, nombre } = SALTO_DEL_BAJO[salto]!;
  return { valor, motivo: `${de}: el bajo ${nombre}.` };
}

export function bajo(j: Juicio): Hecho {
  const vuelta = enlaceDeVuelta(j);
  return juntar([
    ...enlacesNuevos(j).map((k) => ({
      hecho: saltoDelBajo(j.cancion[k - 1]!, j.cancion[k]!),
      peso: esDudoso(j, k - 1) ? 0.5 : 1,
    })),
    ...(vuelta === null ? [] : [{ hecho: saltoDelBajo(...vuelta), peso: 1 }]),
  ]);
}
