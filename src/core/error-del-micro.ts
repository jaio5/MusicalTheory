/**
 * Por qué no se ha abierto el micrófono, dicho para quien lo tiene que arreglar.
 *
 * Lo traducían dos sitios y cada uno a su manera —el motor de análisis
 * (`audio/web-audio-input.ts`) y el micro de grabar (`media/browser-mic-input.ts`)—,
 * y el segundo metía en el mismo saco «no hay micrófono» y «otra aplicación lo
 * tiene»: dos arreglos distintos con una sola frase. Vive en `core/` porque lo
 * piden dos capas que no se importan entre sí, y escribir frases no necesita
 * navegador.
 *
 * Cada frase dice **qué hacer**, y en el caso que más pasa —el permiso
 * denegado— dónde está el mando: el candado de la barra de direcciones, que es
 * el sitio en Chrome, Edge, Firefox y Safari.
 */

export type MotivoDelMicro = 'denegado' | 'sin-micro' | 'ocupado' | 'otro';

export interface ErrorDelMicro {
  readonly motivo: MotivoDelMicro;
  readonly mensaje: string;
}

const FRASES: Readonly<Record<MotivoDelMicro, string>> = {
  denegado:
    'El navegador tiene bloqueado el micrófono para esta página. Pulsa el candado de la barra de direcciones, permite el micrófono y vuelve a pulsar.',
  'sin-micro':
    'No encuentro ningún micrófono. Conecta uno —o la tarjeta de sonido— y vuelve a pulsar.',
  ocupado: 'Otra aplicación está usando el micrófono. Ciérrala y vuelve a pulsar.',
  otro: 'No se ha podido abrir el micrófono. Vuelve a pulsar; si sigue igual, recarga la página.',
};

/** El motivo, por el nombre del error que da `getUserMedia`. */
function motivoDe(nombre: string): MotivoDelMicro {
  switch (nombre) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denegado';
    // `OverconstrainedError` es pedir un micro concreto que ya no está: para
    // quien toca, lo mismo que no tener ninguno.
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'sin-micro';
    case 'NotReadableError':
      return 'ocupado';
    default:
      return 'otro';
  }
}

/** Lo que pasó con `getUserMedia`, a partir de lo que lanzó. */
export function errorDelMicro(causa: unknown): ErrorDelMicro {
  const motivo = motivoDe(causa instanceof Error ? causa.name : '');
  return { motivo, mensaje: FRASES[motivo] };
}
