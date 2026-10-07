/**
 * Contar desde el navegador, sin cookies y sin nada de fuera.
 *
 * Lo que sale de aquí es un evento de una lista cerrada —«visita», «unidad
 * terminada», «toma grabada»— y, en las visitas, la ruta. **Nada de lo que se
 * escribe ni nada de lo que suena**: el audio no sale del aparato y esto no lo
 * cambia ([adr/0110](../../docs/adr/0110-contar-sin-seguir.md)).
 *
 * **Solo se guarda algo en el aparato si se dice que sí.** Para saber si alguien
 * vuelve hace falta reconocerle, y guardar un identificador en su navegador para
 * medir audiencia pide permiso (LSSI art. 22.2, según la guía de cookies de la
 * AEPD, aunque no sea una cookie). Sin ese sí, lo que se manda no lleva nada con
 * qué reconocerle: se suma y ya. Con cuenta, quien le reconoce es el servidor,
 * por la sesión que ya tiene.
 *
 * Con `Do Not Track` o `Global Privacy Control` puestos no se manda nada.
 *
 * Lo que importa de aquí son **los tipos** de `core/analytics`, no su código:
 * esto viaja en el paquete de todas las rutas y tiene que pesar lo que pesa un
 * `sendBeacon`.
 */

import type { BrowserEvent } from '@core/analytics';

import { Emisor } from '@core/estado-observable';

const CLAVE = 'caos-ordenado:contar-vueltas';

/** Avisa a quien pinta el interruptor de que ha cambiado. */
const cambios = new Emisor<boolean>();

/** Si el navegador pide que no se le siga. */
export function pideQueNoLeSigan(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

function leerIdentificador(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    // Modo privado o almacenamiento bloqueado: es lo mismo que no haber dicho que sí.
    return null;
  }
}

/** Si este navegador ha dicho que sí a que se cuenten sus vueltas. */
export function cuentaVueltas(): boolean {
  return typeof localStorage !== 'undefined' && leerIdentificador() !== null;
}

/**
 * Un UUID v4. `crypto.randomUUID` solo existe en un origen seguro, y en `http://`
 * por la red de casa no lo hay; los bytes aleatorios sí.
 */
function nuevoIdentificador(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Decir que sí o que no. Que no **borra** el identificador: no basta con dejar de
 * mandarlo, porque seguiría guardado en el aparato sin servir para nada.
 */
export function permitirContarVueltas(si: boolean): void {
  try {
    if (si) {
      if (leerIdentificador() === null) {
        localStorage.setItem(CLAVE, nuevoIdentificador());
      }
    } else {
      localStorage.removeItem(CLAVE);
    }
  } catch {
    // Sin almacenamiento no hay nada que guardar ni que borrar.
  }
  cambios.emitir(cuentaVueltas());
}

/** Para `useSyncExternalStore` del interruptor. */
export function alCambiarElPermiso(oyente: () => void): () => void {
  return cambios.suscribir(oyente);
}

/**
 * Manda un evento y se olvida. Nunca lanza ni hace esperar.
 *
 * `sendBeacon` y no `fetch`: sobrevive a cerrar la pestaña —el último «toma
 * grabada» suele ser justo antes de irse— y el navegador lo manda cuando le viene
 * bien, sin competir con lo que se está pintando. **Donde no existe no se cuenta**,
 * en vez de caer a un `fetch`: lo tienen todos los navegadores en los que funciona
 * el micro, y un `fetch` de más en cada guardado se mezclaba con los que miran los
 * tests de las pantallas.
 */
export function contar(evento: BrowserEvent, ruta?: string): void {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.sendBeacon !== 'function' ||
    pideQueNoLeSigan()
  ) {
    return;
  }
  const visitante = leerIdentificador();
  const cuerpo = JSON.stringify({
    evento,
    ...(ruta === undefined ? {} : { ruta }),
    ...(visitante === null ? {} : { visitante }),
  });
  try {
    navigator.sendBeacon('/api/metricas', new Blob([cuerpo], { type: 'application/json' }));
  } catch {
    // Contar es lo último que puede romper una pantalla.
  }
}
