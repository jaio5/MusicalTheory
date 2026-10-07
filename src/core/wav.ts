/**
 * Leer un WAV y quedarse con una sola señal en coma flotante.
 *
 * Lo usa la medida de tomas (`scripts/medir-tomas.ts`), que le pasa al motor de
 * acordes en diferido grabaciones hechas fuera de la aplicación —con el móvil, con
 * una interfaz, con lo que tenga quien mide—. Está aquí, y no en el script, porque
 * es lógica que puede equivocarse en silencio: un WAV leído con el orden de bytes
 * mal o con el canal equivocado no da error, da **acordes peores**, y se leería
 * como que el motor falla.
 *
 * Bytes en la entrada y muestras en la salida: no toca el disco ni el navegador.
 */

export interface SenalLeida {
  readonly sampleRate: number;
  /** Mono, de -1 a 1. Con varios canales, su media. */
  readonly samples: Float32Array;
}

/** Los formatos que se entienden: PCM entero y coma flotante. */
const PCM = 1;
const FLOTANTE = 3;
/** `WAVE_FORMAT_EXTENSIBLE`: el formato de verdad va dentro, en el subformato. */
const EXTENSIBLE = 0xfffe;

function texto(vista: DataView, desde: number, largo: number): string {
  let salida = '';
  for (let i = 0; i < largo; i += 1) {
    salida += String.fromCharCode(vista.getUint8(desde + i));
  }
  return salida;
}

/**
 * Una muestra, ya en -1..1.
 *
 * Los 24 bits no tienen lector propio en `DataView`, así que se montan a mano con
 * su signo: es lo que graba casi cualquier interfaz de audio, y leerlos como 16
 * daría ruido con forma de música.
 */
function muestra(vista: DataView, en: number, bits: number, flotante: boolean): number {
  if (flotante) {
    return bits === 64 ? vista.getFloat64(en, true) : vista.getFloat32(en, true);
  }
  switch (bits) {
    case 8:
      // El de ocho bits es el único sin signo: el silencio está en 128.
      return (vista.getUint8(en) - 128) / 128;
    case 16:
      return vista.getInt16(en, true) / 32_768;
    case 24: {
      const crudo =
        vista.getUint8(en) | (vista.getUint8(en + 1) << 8) | (vista.getInt8(en + 2) << 16);
      return crudo / 8_388_608;
    }
    default:
      return vista.getInt32(en, true) / 2_147_483_648;
  }
}

/**
 * La señal de un WAV, o un error que diga por qué no.
 *
 * **El tamaño del bloque de datos no se cree a ciegas.** Lo que escribe `ffmpeg`
 * por una tubería —que es como llegan aquí las grabaciones del móvil— no sabe de
 * antemano cuánto va a ocupar y pone el máximo; se lee hasta donde haya fichero.
 */
export function leerWav(bytes: Uint8Array): SenalLeida {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || texto(vista, 0, 4) !== 'RIFF' || texto(vista, 8, 4) !== 'WAVE') {
    throw new SyntaxError('No es un WAV: no empieza por RIFF…WAVE.');
  }

  let formato: { codigo: number; canales: number; sampleRate: number; bits: number } | null = null;
  let pos = 12;
  while (pos + 8 <= bytes.byteLength) {
    const id = texto(vista, pos, 4);
    const declarado = vista.getUint32(pos + 4, true);
    const inicio = pos + 8;
    const largo = Math.min(declarado, bytes.byteLength - inicio);

    if (id === 'fmt ') {
      let codigo = vista.getUint16(inicio, true);
      if (codigo === EXTENSIBLE && largo >= 26) {
        codigo = vista.getUint16(inicio + 24, true);
      }
      formato = {
        codigo,
        canales: vista.getUint16(inicio + 2, true),
        sampleRate: vista.getUint32(inicio + 4, true),
        bits: vista.getUint16(inicio + 14, true),
      };
    } else if (id === 'data') {
      if (formato === null) {
        throw new SyntaxError('El WAV trae los datos antes que el formato.');
      }
      return decodificar(vista, inicio, largo, formato);
    }
    // Los bloques van alineados a dos bytes: uno impar lleva un relleno detrás.
    pos = inicio + declarado + (declarado % 2);
  }
  throw new SyntaxError('El WAV no trae bloque de datos.');
}

function decodificar(
  vista: DataView,
  inicio: number,
  largo: number,
  formato: { codigo: number; canales: number; sampleRate: number; bits: number },
): SenalLeida {
  const { codigo, canales, sampleRate, bits } = formato;
  const flotante = codigo === FLOTANTE;
  const bitsValidos = flotante ? [32, 64] : [8, 16, 24, 32];
  if ((codigo !== PCM && !flotante) || !bitsValidos.includes(bits) || canales < 1) {
    throw new SyntaxError(
      `Formato de WAV no soportado (código ${codigo}, ${bits} bits, ${canales} canales).`,
    );
  }

  const porMuestra = bits / 8;
  const porTrama = porMuestra * canales;
  const tramas = Math.floor(largo / porTrama);
  const samples = new Float32Array(tramas);
  for (let t = 0; t < tramas; t += 1) {
    let suma = 0;
    for (let c = 0; c < canales; c += 1) {
      suma += muestra(vista, inicio + t * porTrama + c * porMuestra, bits, flotante);
    }
    samples[t] = suma / canales;
  }
  return { sampleRate, samples };
}
