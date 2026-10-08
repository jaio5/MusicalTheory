import { useEffect, useRef, useState } from 'react';

/**
 * Cuánto se queda un estado antes de poder cambiar otra vez.
 *
 * Mil quinientos milisegundos: lo que tarda alguien en leer una frase corta. Con
 * menos, el aviso se retira antes de que se haya leído; con más, tarda en decir
 * que ya está bien lo que se acaba de arreglar.
 */
export const PERMANENCIA_MS = 1500;

/**
 * Un estado que no parpadea: cambia cuando se lo piden y **no antes de
 * `PERMANENCIA_MS` desde el último cambio**.
 *
 * El aviso de nivel alternaba cada ~700 ms entre «llega poca señal» y «llega
 * señal de sobra» mientras el nivel rondaba el umbral, y el de «no llega limpia»
 * salía y se iba con una nota limpia delante. Un umbral solo no lo arregla: da
 * igual dónde se ponga, una señal que lo roza lo cruza veinte veces por segundo.
 *
 * Hacen falta dos cosas, y esto es la segunda:
 *
 * - **Dos umbrales**, uno para entrar y otro para salir —`entra` y `sale`, que
 *   quien llama calcula—. Entre los dos no pasa nada, y esa franja es la que se
 *   come el ruido.
 * - **Un tiempo mínimo en cada estado**, para lo que cruza los dos umbrales de un
 *   lado a otro de verdad.
 *
 * El primer cambio es inmediato: nadie ha visto todavía ningún estado que haya
 * que dejar leer. Y si la razón del cambio desaparece mientras se espera, no
 * cambia: el temporizador muere con el efecto.
 *
 * **Salvo que se pida esperar para entrar** (`esperaAlEntrarMs`): entonces la
 * razón tiene que durar ese tiempo seguido. Es para el aviso de señal sucia, que
 * con una nota limpia salía igual: el ataque de la púa y la cola de la nota
 * bajan la claridad un instante, y como el primer cambio era inmediato, ese
 * instante dejaba «no llega limpia» segundo y medio al lado de «Está afinada».
 */
export function useEstable(
  entra: boolean,
  sale: boolean,
  permanenciaMs = PERMANENCIA_MS,
  esperaAlEntrarMs = 0,
): boolean {
  const [valor, setValor] = useState(false);
  const desde = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    if (!(valor ? sale : entra)) {
      return;
    }
    const espera = Math.max(
      valor ? 0 : esperaAlEntrarMs,
      desde.current + permanenciaMs - performance.now(),
    );
    const temporizador = setTimeout(() => {
      desde.current = performance.now();
      setValor(!valor);
    }, espera);
    return () => clearTimeout(temporizador);
  }, [valor, entra, sale, permanenciaMs, esperaAlEntrarMs]);

  return valor;
}
