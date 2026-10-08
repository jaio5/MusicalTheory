import { ficheroMidi, nombreDeFichero, soundOf, type Arrangement } from '@core/music';
import { descargarBytes, TIPO_MIDI } from '@media/descargar';

import { useArrangementStore } from './arrangement-store';
import { selectActiveKey, useSessionStore } from './session-store';

/**
 * Cómo se llama la canción: la primera parte que tiene acordes, que es la que se
 * oye primero, o la primera a secas si ninguna tiene.
 *
 * Un criterio y no dos: el lienzo titulaba con la primera parte y Canciones con
 * la primera con acordes, y la misma canción salía de cada sitio con otro nombre.
 */
export function tituloDeLaCancion(arrangement: Arrangement): string | null {
  const parte =
    arrangement.parts.find((una) => una.blocks.length > 0) ?? arrangement.parts[0] ?? null;
  return parte?.name ?? null;
}

/**
 * La canción del lienzo, en un fichero MIDI. Devuelve si había algo que bajar:
 * sin tonalidad o sin partes no hay canción, y quien llama dice qué falta.
 *
 * Sale de `soundOf`, que es lo mismo que suena al darle a escuchar: si algún día
 * lo que se oye y lo que se descarga dejan de coincidir, será porque alguien
 * metió un segundo camino, no porque haya dos cuentas distintas. **Y está aquí,
 * una vez**, porque se descarga desde la barra del lienzo y desde Canciones, y
 * cada uno lo tenía copiado a su manera.
 */
export function descargarLaCancion(): boolean {
  const { arrangement } = useArrangementStore.getState();
  const sesion = useSessionStore.getState();
  const tonalidad = selectActiveKey(sesion);
  const titulo = tituloDeLaCancion(arrangement);
  if (tonalidad === null || titulo === null) {
    return false;
  }
  const { events } = soundOf(arrangement, tonalidad.tonic, tonalidad.mode);
  // Siempre hay un nombre: el almacén pone «Parte 1» a la que se crea sin él, y
  // si alguna vez llegara vacío, `nombreDeFichero` ya devuelve «cancion.mid».
  descargarBytes(
    ficheroMidi(events, { nombre: titulo, bpm: sesion.bpm, beatsPerBar: sesion.beatsPerBar }),
    nombreDeFichero(titulo),
    TIPO_MIDI,
  );
  return true;
}
