/**
 * Un estado que se puede mirar y al que se puede uno apuntar.
 *
 * Lo tenían escrito tres veces, calcado: el micrófono de `audio/`, el de
 * `media/` y la grabadora. Las tres guardaban un `Set` de oyentes, un valor
 * actual, un `subscribe` que devuelve la baja y un `setState` que compara antes
 * de avisar. Aquí está una vez.
 *
 * **La comparación antes de avisar no es un ahorro, es la condición.** Quien se
 * apunta suele acabar en un `useSyncExternalStore` o en un `setState` de React,
 * y avisar de un cambio que no ha cambiado nada vuelve a pintar la pantalla en
 * bucle. Por eso `cambiarA` con el mismo valor no llama a nadie.
 *
 * Vive en `core/` porque no toca el navegador: es un `Set` y un valor.
 */
export type Oyente<E> = (estado: E) => void;

/**
 * La lista de apuntados, sin estado: sirve para lo que **pasa** en vez de para
 * lo que **es**.
 *
 * Lo usan los motores de audio, que no tienen un estado que consultar sino una
 * lectura nueva cada décima de segundo: el acorde que se oye, la nota, el nivel
 * de señal. Ahí no hay nada que comparar antes de avisar —dos lecturas iguales
 * seguidas siguen siendo dos lecturas— y por eso `emitir` no filtra.
 */
export class Emisor<V> {
  readonly #oyentes = new Set<Oyente<V>>();

  emitir(valor: V): void {
    for (const oyente of this.#oyentes) {
      oyente(valor);
    }
  }

  /** Devuelve la función que da de baja: es lo que espera un efecto de React. */
  suscribir(oyente: Oyente<V>): () => void {
    this.#oyentes.add(oyente);
    return () => {
      this.#oyentes.delete(oyente);
    };
  }
}

export class EstadoObservable<E> {
  #valor: E;

  readonly #emisor = new Emisor<E>();

  constructor(inicial: E) {
    this.#valor = inicial;
  }

  get valor(): E {
    return this.#valor;
  }

  /** Cambia el estado y avisa. Si es el mismo, no avisa a nadie. */
  cambiarA(estado: E): void {
    if (this.#valor === estado) {
      return;
    }
    this.#valor = estado;
    this.#emisor.emitir(estado);
  }

  /** Devuelve la función que da de baja: es lo que espera un efecto de React. */
  suscribir(oyente: Oyente<E>): () => void {
    return this.#emisor.suscribir(oyente);
  }
}
