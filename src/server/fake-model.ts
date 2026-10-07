/**
 * El modelo que no piensa.
 *
 * Tercer puerto con la misma forma que los otros dos: el cobrador que no cobra
 * (`billing/fake.ts`) y el correo que no manda (`mail/none.ts`). Y por la misma
 * razón: sin él, media aplicación no se puede probar sin dar de alta un servicio
 * y empezar a pagar por tokens.
 *
 * **Lo que devuelve sale del dominio, no de un fichero de ejemplos.** Las
 * salidas son las del menú que se le da al modelo (`salidasPosibles`, construidas
 * con los movimientos, el grafo y las cadencias que las juzgan, y que la ruta le
 * pasa tal cual), así que pasan la misma verificación que pasaría una respuesta del
 * modelo. Eso es lo que permite
 * probar la pantalla, la reproducción y «ponerla en el camino» sin gastar un
 * céntimo.
 *
 * Lo que **no** prueba, y hay que tenerlo claro: si el modelo de verdad devuelve
 * versiones que valgan la pena. Eso no lo puede decir nada que no sea el modelo.
 * Por eso cada cosa que sale de aquí lo dice en su propio texto: en pantalla se
 * lee «Sin IA», no un título que parezca escrito por alguien.
 */

import { MAX_VERSIONS } from '@core/billing';
import {
  pitchClassFromName,
  respuestaDelGlosario,
  type KeyMode,
  type NoteName,
  type SalidaPosible,
} from '@core/music';

/** La marca que llevan todas las respuestas de aquí. Se lee en pantalla. */
export const SIN_IA = 'Sin IA';

interface Peticion {
  /**
   * Las salidas que vio el modelo, por su número: **el mismo menú** con el que la
   * ruta escribió el prompt y con el que valida. El número que se contesta aquí
   * tiene que señalar la misma salida allí, y por eso se lo da la ruta en vez de
   * construirlo aquí: `server/` no puede abrir `features/`, que es donde se decide
   * qué salidas entran.
   */
  readonly menu: readonly Pick<SalidaPosible, 'nombre' | 'que'>[];
  /**
   * Cuáles contesta, por su número en el menú (desde 1): las tres mejores, que
   * escoge la ruta con `lasTresMejores`. Sin decirlo, las tres primeras.
   */
  readonly elegidas?: readonly number[];
  /**
   * El porqué de cada salida del menú, por su orden, escrito con los motivos del
   * juez que pasan el validador; vacío si ninguno pasa. Lo pone la ruta, que es la
   * que ve el validador. Sin él, el porqué es lo que hace cada una.
   */
  readonly porques?: readonly string[];
}

/**
 * Salidas elegidas por el dominio, no por un modelo.
 *
 * **Las mismas que se le ofrecen al modelo**, y contestadas igual que él: el
 * número, un título y un porqué. Por eso pasan por el mismo validador y prueban el
 * camino de verdad.
 *
 * **Cuáles, lo decide la ruta**: las tres mejores con variedad
 * (`lasTresMejores`, en `features/versions/menu.ts`), que son también las que el
 * modelo explica cuando no hay directrices. Aquí se contestan.
 *
 * **El porqué es el del juez** —«V I en el 8: cadencia perfecta», «vi IV, el eje
 * del pop»—, que es lo que hace que esta salida encaje y no solo lo que hace; si
 * no hay motivo que se sostenga, lo que hace, en grados.
 *
 * Lo que **no** prueban sigue siendo lo de siempre: si el criterio de un modelo de
 * verdad vale la pena. Por eso todas llevan «Sin IA» escrito en su título.
 */
export function versionesSinIA(peticion: Peticion): {
  readonly versions: readonly { opcion: number; title: string; why: string }[];
} {
  const { menu } = peticion;
  const elegidas = (peticion.elegidas ?? menu.map((_, i) => i + 1))
    .filter((numero) => menu[numero - 1] !== undefined)
    .slice(0, MAX_VERSIONS);
  return {
    versions: elegidas.map((numero) => {
      const salida = menu[numero - 1]!;
      const porque = peticion.porques?.[numero - 1] ?? '';
      return {
        opcion: numero,
        title: `${SIN_IA} · ${salida.nombre}`,
        why: porque === '' ? salida.que : porque,
      };
    }),
  };
}

/** Lo que hace falta de una pregunta al profesor para contestarla sin modelo. */
interface PreguntaSinIA {
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly question: string;
}

/**
 * Una respuesta del profesor que dice lo que es.
 *
 * **Si la pregunta casa con el glosario, contesta el glosario**, resuelto en la
 * tonalidad: sin clave ya se dice algo cierto, y es la misma teoría que va en el
 * prompt cuando hay modelo, así que pasa el mismo validador. Si no casa, dice que
 * no hay modelo y qué hacer, como siempre. Las dos llevan «Sin IA» delante.
 */
export function respuestaSinIA(pregunta?: PreguntaSinIA): unknown {
  const glosario =
    pregunta === undefined
      ? null
      : respuestaDelGlosario(pregunta.question, {
          tonic: pitchClassFromName(pregunta.key.tonic),
          mode: pregunta.key.mode,
        });
  if (glosario !== null) {
    return { tema: 'musica', answer: `${SIN_IA}, del glosario. ${glosario}` };
  }
  return {
    // Declara el tema como cualquier respuesta, porque el validador lo exige a
    // todo el mundo. Un puerto falso que se salte una comprobación deja de servir
    // para lo que existe: probar el camino de verdad sin pagarlo. Y por lo mismo
    // habla de música: el validador tira lo que dice `musica` y no la nombra.
    tema: 'musica',
    answer:
      'Aquí no hay modelo conectado, así que esto no es una respuesta de verdad: es lo que ' +
      'contesta la aplicación cuando le falta la clave. Pon ANTHROPIC_API_KEY y vuelve a preguntar. ' +
      'Mientras, contesta el glosario si nombras lo que buscas: una cadencia, un modo, un intervalo.',
  };
}
