import { Emisor } from '@core/estado-observable';
import type { ComposeDeed } from '@core/music';

/**
 * Lo que se hace componiendo, para que el avance se entere.
 *
 * Existe por un problema de capas, y la alternativa era peor. Quien sabe que
 * acabas de guardar una canción es `features/songs`; quien lleva la racha y la
 * meta del día es `features/learn`, y **un feature no importa de otro**
 * (regla 2). Hilar un `onCompuesto` desde `ComposeScreen` hasta los cuatro
 * sitios significaba una prop nueva atravesando tres paneles que no tienen nada
 * que ver entre sí, y una prop olvidada en cualquiera de ellos es un hecho que
 * no suma sin que nada avise.
 *
 * Con un emisor en `state/` —que las dos capas sí pueden abrir— cada sitio dice
 * lo que ha pasado y no le importa quién escucha. Es el mismo trato que tienen
 * los motores de audio con sus lecturas.
 *
 * **`Emisor` y no `EstadoObservable`**, que es la distinción que ya explica
 * `core/estado-observable.ts`: esto es lo que *pasa*, no lo que *es*. Guardar
 * dos canciones seguidas son dos hechos, y un estado que compara antes de avisar
 * se comería el segundo por ser igual que el primero.
 *
 * Quien escucha es `useProgress`, y solo cuando se lo piden: hay varias
 * pantallas que lo llaman a la vez y dos apuntados contarían cada hecho dos
 * veces.
 */
export const hechosDeComponer = new Emisor<ComposeDeed>();

/** Apunta que se ha compuesto algo. Si no hay nadie escuchando, no pasa nada. */
export function apuntarHecho(deed: ComposeDeed): void {
  hechosDeComponer.emitir(deed);
}
