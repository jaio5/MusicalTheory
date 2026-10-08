/**
 * Los tramos del recorrido y cuál toca en cada pantalla.
 *
 * Aparte de los pasos porque **esto lo lee el lanzador**, que va en el paquete de
 * todas las pantallas, y los pasos con sus textos viajan en su propio trozo, solo
 * a quien le toca verlos ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md)).
 */

/** Los tramos, en el orden en que salen si se visitan todas las pantallas. */
export const TRAMOS = ['bienvenida', 'aprender', 'componer', 'afinar'] as const;

export type Tramo = (typeof TRAMOS)[number];

/** Las pantallas que tienen su tramo, por su dirección exacta. */
const TRAMO_DE_LA_RUTA: Readonly<Record<string, Tramo>> = {
  '/aprender': 'aprender',
  '/componer': 'componer',
  '/afinar': 'afinar',
};

/**
 * Los tramos que tocan en esta pantalla, en el orden en que se enseñan, o
 * ninguno.
 *
 * **La bienvenida va primero, en cualquier pantalla de trabajo**: es la que dice
 * que hay más y que se puede saltar. Después, el de la pantalla en la que se
 * está, si no se ha visto. Las demás —una unidad, el profesor— no tienen tramo:
 * se explican solas, y una guía que sale en cada pantalla es una guía que estorba
 * ([adr/0108](../../../docs/adr/0108-el-recorrido-sale-por-pantallas.md)).
 *
 * **Y los dos van en la misma tarjeta**, «1 de 2» y «2 de 2». Iban por separado,
 * y quien entraba por `/afinar` veía dos tarjetas seguidas que decían las dos
 * «paso 1 de 1»: la segunda parecía la misma que volvía a salir
 * ([adr/0120](../../../docs/adr/0120-la-primera-visita-no-se-mueve-y-cada-pantalla-trae-lo-suyo.md)).
 */
export function tramosPara(vistos: readonly string[], ruta: string): readonly Tramo[] {
  const deLaPantalla = TRAMO_DE_LA_RUTA[ruta];
  const pendientes: Tramo[] = vistos.includes('bienvenida') ? [] : ['bienvenida'];
  if (deLaPantalla !== undefined && !vistos.includes(deLaPantalla)) {
    pendientes.push(deLaPantalla);
  }
  return pendientes;
}
