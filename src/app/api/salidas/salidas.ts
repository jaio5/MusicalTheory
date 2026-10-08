import { TOKEN_BUDGETS } from '@core/billing';
import type { SalidaPosible } from '@core/music';

import {
  MAX_SALIDA_WHY_LENGTH,
  seSostiene,
  validateSalidas,
  type SalidaPropuesta,
} from '@features/salidas/contract';
import type { SalidasRequest } from '@features/salidas/peticion';
import { lasTresMejores, menuDe, soloExplica } from '@features/salidas/menu';
import { enAcordes, menuDelPrompt, promptDeSalidas } from './prompt';
import type { FalloDelModelo, PreguntaAlModelo } from '@server/ai-intentos';
import { salidasSinIA } from '@server/fake-model';
import { lineaDeTonalidad, salidasSchema, SALIDAS_SYSTEM_PROMPT } from '@server/prompts';

/** Lo que contesta la ruta: las salidas y, si las eligió el dominio, por qué. */
export type RespuestaDeSalidas =
  | { readonly versions: readonly SalidaPropuesta[] }
  | {
      readonly versions: readonly SalidaPropuesta[];
      readonly origen: 'dominio';
      readonly motivo: FalloDelModelo;
    };

/** La cabecera del prompt de las salidas: la línea de la tonalidad. */
function cabeceraDe(peticion: SalidasRequest): string[] {
  return [lineaDeTonalidad(peticion.key)];
}

/**
 * Las salidas del menú que caben en el prompt: las que el modelo ve y puede elegir.
 *
 * **Una vez por petición**: las piden el esquema, el validador y el respaldo sin
 * clave, y armar el menú es buscar todas las salidas y juzgarlas. Se guardan por
 * la petición, que es el mismo objeto en las tres llamadas (`server/ai-intentos.ts`),
 * y se van con ella.
 */
const VISTAS = new WeakMap<SalidasRequest, readonly SalidaPosible[]>();

function lasQueSeVen(peticion: SalidasRequest): readonly SalidaPosible[] {
  let vistas = VISTAS.get(peticion);
  if (vistas === undefined) {
    vistas = menuDelPrompt(peticion, cabeceraDe(peticion)).map((opcion) => opcion.salida);
    VISTAS.set(peticion, vistas);
  }
  return vistas;
}

/**
 * El porqué de una salida con los motivos del juez: los dos si caben en el porqué
 * de una salida, el primero si no, y nada si no hay ninguno que se sostenga.
 */
export function porqueDelJuez(motivos: readonly string[]): string {
  const juntos = motivos.join(' ');
  return juntos.length <= MAX_SALIDA_WHY_LENGTH ? juntos : motivos[0]!;
}

/**
 * Lo que contesta el dominio solo, sin modelo: las tres que mejor encajan, con el
 * porqué del juez.
 *
 * **Las mismas tres que explica el modelo sin directrices** (`lasTresMejores`):
 * sin ellas el menú que vio son esas tres, y con ellas se buscan en el menú
 * entero. Así el respaldo da lo mismo que daría el modelo, que es lo que se le
 * pide: contarlas, no cambiarlas. **Y solo entre las que se le enseñaron al
 * modelo**, que es por cuyo número contesta.
 *
 * Los motivos son los del menú entero aunque el prompt callara alguno por sitio,
 * con sus acordes como en el prompt (`enAcordes`) y solo los que pasan el
 * validador: lo que no, se taparía con lo que hace.
 */
function delDominio(peticion: SalidasRequest): unknown {
  const vistas = lasQueSeVen(peticion);
  return salidasSinIA({
    menu: vistas,
    elegidas: lasTresMejores(vistas, peticion.progression).map((i) => i + 1),
    porques: menuDe(peticion, (motivo, salida) =>
      seSostiene(enAcordes(motivo, peticion), salida, peticion),
    ).map(({ motivos }) => porqueDelJuez(motivos.map((motivo) => enAcordes(motivo, peticion)))),
  });
}

/**
 * Lo que las salidas le preguntan al modelo y cómo comprueban lo que vuelve.
 *
 * Fuera de `route.ts` por lo mismo que `PROFESOR` (`app/api/teacher/prompt.ts`): un
 * examen de las salidas tiene que preguntar por el mismo camino que la aplicación,
 * y de la ruta no se puede sacar nada sin arrastrar `next/server`, el limitador y
 * las puertas del cupo. Un fichero de ruta, además, solo puede exportar lo que
 * Next.js entiende.
 *
 * **Las salidas las construye el dominio y el modelo elige**: el prompt lleva el
 * menú numerado (`salidasPosibles`) y lo que vuelve es un número, un título y un
 * porqué por salida.
 */
export const SALIDAS: PreguntaAlModelo<SalidasRequest, RespuestaDeSalidas> = {
  prompt: (peticion) => promptDeSalidas(peticion, cabeceraDe(peticion)),
  system: SALIDAS_SYSTEM_PROMPT,
  // El esquema depende de cuántas salidas se le enseñan: el número que elige es
  // un enumerado, y no puede elegir una que no ha visto. Y sin directrices las
  // tiene que contar todas, que son las tres mejores (`soloExplica`).
  schema: (peticion) => salidasSchema(lasQueSeVen(peticion).length, soloExplica(peticion)),
  /**
   * El tope de salida sale del dominio: es el mismo número con el que
   * `core/billing/cost.ts` calcula el cupo de los planes de pago.
   */
  maxTokens: TOKEN_BUDGETS.salidas.output,
  sinClave: delDominio,
  validar: (payload, peticion) => {
    // Con lo que vio, porque **lo que vio depende de las directrices**: sin ellas,
    // las tres mejores; con ellas, las que quepan. El número es el de ese menú en
    // los dos casos, y el contrato numera el mismo (`salidasDe`). Y con el prompt
    // de sistema, para tapar el título o el porqué que lo copie (adr/0115), como
    // hace el profesor con su respuesta.
    const propuestas = validateSalidas(payload, peticion, {
      vistas: lasQueSeVen(peticion).length,
      instrucciones: SALIDAS_SYSTEM_PROMPT,
    });
    return propuestas.length > 0 ? { versions: propuestas } : null;
  },
  /**
   * **Que nunca se quede sin salida.** Si el modelo no contesta, se corta o lo
   * que dice no pasa el validador las dos veces, contesta el dominio con su menú:
   * las mismas salidas que se le ofrecieron al modelo, con sus títulos y su
   * porqué, que son verdad porque los escribe quien las construyó.
   *
   * Y lo dice: `origen: 'dominio'` en la respuesta y «Sin IA» en cada título. El
   * cupo ya se ha gastado —se cobra el intento—, y lo que se le debe a quien lo
   * pagó es saber que esto no lo eligió el modelo.
   *
   * **Y por qué**, en `motivo`: un modelo caído y uno que contestó algo que no se
   * sostiene no piden lo mismo de quien lo lee —esperar un minuto o volver a
   * pedirlo—, y la pantalla elige la frase con él.
   */
  respaldo: (peticion, motivo) => {
    const propuestas = validateSalidas(delDominio(peticion), peticion);
    /* v8 ignore next -- el contrato no deja pedir sin salidas posibles */
    return propuestas.length > 0
      ? { versions: propuestas, origen: 'dominio' as const, motivo }
      : null;
  },
};
