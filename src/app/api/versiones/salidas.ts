import { TOKEN_BUDGETS } from '@core/billing';
import { isRecord } from '@core/parse';

import {
  MAX_VERSION_WHY_LENGTH,
  seSostiene,
  validateVersions,
  type Version,
  type VersionsRequest,
} from '@features/versions/contract';
import { lasTresMejores, menuDe, soloExplica } from '@features/versions/menu';
import { enAcordes, menuDelPrompt, promptDeSalidas } from '@features/versions/prompt';
import type { FalloDelModelo, PreguntaAlModelo } from '@server/ai-intentos';
import { versionesSinIA } from '@server/fake-model';
import { lineaDeTonalidad, versionsSchema, VERSIONS_SYSTEM_PROMPT } from '@server/prompts';

/** Lo que contesta la ruta: las salidas y, si las eligió el dominio, por qué. */
export type RespuestaDeSalidas =
  | { readonly versions: readonly Version[] }
  | {
      readonly versions: readonly Version[];
      readonly origen: 'dominio';
      readonly motivo: FalloDelModelo;
    };

/** La cabecera del prompt de las salidas: la línea de la tonalidad. */
function cabeceraDe(peticion: VersionsRequest): string[] {
  return [lineaDeTonalidad(peticion.key)];
}

/** Las salidas del menú que caben en el prompt: las que el modelo ve y puede elegir. */
function lasQueSeVen(peticion: VersionsRequest) {
  return menuDelPrompt(peticion, cabeceraDe(peticion)).map((opcion) => opcion.salida);
}

function cuantasSeVen(peticion: VersionsRequest): number {
  return lasQueSeVen(peticion).length;
}

/**
 * El porqué de una salida con los motivos del juez: los dos si caben en el porqué
 * de una salida, el primero si no, y nada si no hay ninguno que se sostenga.
 */
export function porqueDelJuez(motivos: readonly string[]): string {
  const juntos = motivos.join(' ');
  return juntos.length <= MAX_VERSION_WHY_LENGTH ? juntos : motivos[0]!;
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
function delDominio(peticion: VersionsRequest): unknown {
  const vistas = lasQueSeVen(peticion);
  return versionesSinIA({
    menu: vistas,
    elegidas: lasTresMejores(vistas, peticion.progression).map((i) => i + 1),
    porques: menuDe(peticion, (motivo, salida) =>
      seSostiene(enAcordes(motivo, peticion), salida, peticion),
    ).map(({ motivos }) => porqueDelJuez(motivos.map((motivo) => enAcordes(motivo, peticion)))),
  });
}

/**
 * Lo que contestó el modelo, sin lo que eligió fuera de lo que vio.
 *
 * El esquema ya no se lo deja —el número es un enumerado de las que caben en el
 * prompt—, y los dos proveedores lo cumplen. Pero el contrato valida contra el
 * menú entero, y un porqué escrito sin ver la salida no se le enseña a nadie.
 *
 * **Lo que vio depende de las directrices**: sin ellas, las tres mejores, del uno
 * al tres; con ellas, las seis que quepan. El número es el de ese menú en los dos
 * casos, y el contrato numera el mismo (`salidasDe`).
 */
function soloLoQueVio(payload: unknown, peticion: VersionsRequest): unknown {
  if (!isRecord(payload) || !Array.isArray(payload['versions'])) {
    return payload;
  }
  const vistas = cuantasSeVen(peticion);
  return {
    versions: payload['versions'].filter(
      (v) => !isRecord(v) || typeof v['opcion'] !== 'number' || v['opcion'] <= vistas,
    ),
  };
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
export const SALIDAS: PreguntaAlModelo<VersionsRequest, RespuestaDeSalidas> = {
  prompt: (peticion) => promptDeSalidas(peticion, cabeceraDe(peticion)),
  system: VERSIONS_SYSTEM_PROMPT,
  // El esquema depende de cuántas salidas se le enseñan: el número que elige es
  // un enumerado, y no puede elegir una que no ha visto. Y sin directrices las
  // tiene que contar todas, que son las tres mejores (`soloExplica`).
  schema: (peticion) => versionsSchema(cuantasSeVen(peticion), soloExplica(peticion)),
  /**
   * El tope de salida sale del dominio: es el mismo número con el que
   * `core/billing/cost.ts` calcula el cupo de los planes Medio y Pro.
   */
  maxTokens: TOKEN_BUDGETS.versiones.output,
  sinClave: delDominio,
  validar: (payload, peticion) => {
    const versions = validateVersions(soloLoQueVio(payload, peticion), peticion);
    return versions.length > 0 ? { versions } : null;
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
    const versions = validateVersions(delDominio(peticion), peticion);
    /* v8 ignore next -- el contrato no deja pedir sin salidas posibles */
    return versions.length > 0 ? { versions, origen: 'dominio' as const, motivo } : null;
  },
};
