/**
 * Un filtro de dos polos, el de siempre: el del libro de cocina de Robert
 * Bristow-Johnson, que es **el mismo que usa `BiquadFilterNode`**.
 *
 * Existe por el clic. El metrónomo fabrica su golpe de ruido ya filtrado
 * —`metronome.ts`— para no depender de dos nodos más en cada pulso, y los tests
 * necesitan reproducir el paso bajo de la entrada (`web-audio-input.ts`) sobre
 * una señal sintética. Las dos cosas tienen que ser el mismo filtro que corre en
 * el navegador, o lo medido aquí no dice nada de lo que pasa allí.
 *
 * Matemática pura: entra un `Float32Array` y sale otro. Ni reloj ni navegador.
 */

export type TipoDeFiltro = 'paso-alto' | 'paso-bajo';

/** Butterworth: la Q que no levanta joroba en el corte. */
const Q_PLANA = Math.SQRT1_2;

/**
 * Filtra la señal en su sitio y la devuelve.
 *
 * En su sitio porque quien lo llama ya tiene un búfer suyo —el clic recién
 * hecho, la copia de una grabación— y duplicarlo en cada pasada es basura que no
 * hace falta.
 */
export function filtrar(
  muestras: Float32Array,
  tipo: TipoDeFiltro,
  corte: number,
  sampleRate: number,
): Float32Array {
  const w = (2 * Math.PI * corte) / sampleRate;
  const alfa = Math.sin(w) / (2 * Q_PLANA);
  const coseno = Math.cos(w);
  const a0 = 1 + alfa;
  // Los dos tipos comparten polos; solo cambian los ceros.
  const b1 = (tipo === 'paso-alto' ? -(1 + coseno) : 1 - coseno) / a0;
  const b0 = Math.abs(b1) / 2;
  const a1 = (-2 * coseno) / a0;
  const a2 = (1 - alfa) / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < muestras.length; i += 1) {
    const x = muestras[i]!;
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    muestras[i] = y;
  }
  return muestras;
}
