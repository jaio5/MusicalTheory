/**
 * Transformada rápida de Fourier, escrita aquí.
 *
 * En vivo el espectro lo da el navegador: un `AnalyserNode` lo calcula solo y
 * `chroma.ts` lo lee. Eso vale mientras el análisis vaya al ritmo del sonido,
 * pero **no sirve para estudiar una grabación**: el `AnalyserNode` mira lo que
 * está entrando ahora, no un trozo de memoria de hace dos minutos.
 *
 * Y estudiar la grabación es justo lo que hace falta, porque en tiempo real el
 * motor decide con cuatro décimas de contexto y sin poder mirar hacia delante.
 * Con el trozo entero se puede usar una ventana mucho más larga —que es lo que
 * separa dos semitonos en el grave, donde más falla— y decidir cada instante
 * sabiendo lo que vino después.
 *
 * Se escribe aquí y no se trae una librería por lo mismo que la autocorrelación
 * ([adr/0002](../../docs/adr/0002-deteccion-de-tono-propia.md)): son cuarenta
 * líneas, se prueban solas, y una dependencia de DSP es una dependencia que
 * actualizar y auditar para siempre.
 *
 * **Dominio puro**: entra un array de muestras y sale un array de decibelios. No
 * toca `window` ni `AudioContext`, así que se prueba en Node como cualquier otra
 * cosa de `core/`.
 */

/** Radix-2: el tamaño tiene que ser potencia de dos. */
function esPotenciaDeDos(n: number): boolean {
  return n > 1 && (n & (n - 1)) === 0;
}

/**
 * FFT en el sitio, radix-2 decimación en tiempo.
 *
 * `re` e `im` entran con la señal y salen con el espectro. Se pasan los dos
 * arrays en vez de devolver uno nuevo porque esto se llama una vez por ventana y
 * una grabación de dos minutos son unas dos mil: reservar dos arrays cada vez es
 * basura que el recolector tiene que barrer mientras la pantalla espera.
 */
export function fftEnSitio(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (!esPotenciaDeDos(n) || im.length !== n) {
    throw new RangeError('La FFT pide dos arrays del mismo tamaño y potencia de dos.');
  }

  // Reordenar por inversión de bits. Es lo que permite que el resto trabaje en
  // el sitio: las parejas que hay que combinar quedan contiguas.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }

  for (let largo = 2; largo <= n; largo <<= 1) {
    const angulo = (-2 * Math.PI) / largo;
    const pasoRe = Math.cos(angulo);
    const pasoIm = Math.sin(angulo);

    for (let inicio = 0; inicio < n; inicio += largo) {
      // El giro se acumula multiplicando en vez de llamar a cos y sin en cada
      // vuelta: son dos millones de llamadas en una grabación de dos minutos.
      let giroRe = 1;
      let giroIm = 0;

      for (let k = 0; k < largo / 2; k += 1) {
        const a = inicio + k;
        const b = a + largo / 2;

        const parRe = re[b]! * giroRe - im[b]! * giroIm;
        const parIm = re[b]! * giroIm + im[b]! * giroRe;

        re[b] = re[a]! - parRe;
        im[b] = im[a]! - parIm;
        re[a] = re[a]! + parRe;
        im[a] = im[a]! + parIm;

        const siguienteRe = giroRe * pasoRe - giroIm * pasoIm;
        giroIm = giroRe * pasoIm + giroIm * pasoRe;
        giroRe = siguienteRe;
      }
    }
  }
}

/**
 * El suelo en decibelios de una casilla sin nada.
 *
 * El mismo -120 que usa el navegador en `AnalyserNode.minDecibels` por defecto,
 * porque lo que sale de aquí lo va a leer `chroma.ts`, que está ajustado contra
 * espectros de esa forma. Un suelo distinto movería todos sus umbrales.
 */
export const SUELO_DB = -120;

/**
 * Ventana de Hann.
 *
 * Sin ventana, cortar la señal en trozos mete un salto en los extremos y el
 * espectro se llena de faldas que no existen —fuga espectral—: un solo acorde
 * aparece rodeado de basura y el croma cuenta notas que nadie ha tocado. Hann
 * porque es la de siempre para esto y porque el `AnalyserNode` usa una parecida,
 * así que el espectro que sale de aquí se parece al que ve el motor en vivo.
 */
function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}

/** Las ventanas se reusan: una grabación de dos minutos pide dos mil. */
const ventanas = new Map<number, Float32Array>();

function ventanaDe(n: number): Float32Array {
  let w = ventanas.get(n);
  if (w === undefined) {
    w = hann(n);
    ventanas.set(n, w);
  }
  return w;
}

/**
 * El espectro de un bloque de muestras, en decibelios y con la misma forma que
 * devuelve `AnalyserNode.getFloatFrequencyData`.
 *
 * Devuelve la mitad de casillas que muestras entran: la otra mitad es el espejo
 * de una señal real y no dice nada nuevo. `chroma.ts` cuenta con eso.
 */
export function espectroDb(muestras: Float32Array, destino?: Float32Array): Float32Array {
  const n = muestras.length;
  const ventana = ventanaDe(n);

  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    re[i] = muestras[i]! * ventana[i]!;
  }

  fftEnSitio(re, im);

  const casillas = n / 2;
  const salida = destino ?? new Float32Array(casillas);
  for (let i = 0; i < casillas; i += 1) {
    // Normalizado por el tamaño para que el nivel no dependa de la ventana
    // elegida: si no, doblar la ventana subiría todo seis decibelios y los
    // umbrales de `chroma.ts` dejarían de valer.
    const magnitud = Math.hypot(re[i]!, im[i]!) / casillas;
    salida[i] = magnitud <= 0 ? SUELO_DB : Math.max(SUELO_DB, 20 * Math.log10(magnitud));
  }
  return salida;
}
