/**
 * La respuesta se cortó por llegar al tope de tokens.
 *
 * Va aparte de los demás fallos porque **reintentarla no puede salir bien**: el
 * prompt es el mismo y el tope también, así que la segunda llamada se corta por
 * donde se cortó la primera. Sin distinguirla, el reintento de `ai-route.ts` —que
 * está para una respuesta que no valida, donde otra tirada sí puede cambiar las
 * cosas— gastaba una llamada que no tenía ninguna posibilidad.
 *
 * El JSON cortado no se puede leer, así que lo que sale es `unparseable_response`,
 * que es literalmente lo que ha pasado: contestó y lo que dijo no vale.
 *
 * **Vive en su propio fichero y no en `ask-model.ts`** porque la lanzan los dos
 * proveedores, y `ask-model` ya importa a `local-model`: ponerla allí haría que
 * `local-model` importara de vuelta y cerrara el ciclo. Este proyecto ya tiene un
 * ciclo contado —`song.ts` con `arrangement.ts`— que no lo vio ningún test y
 * devolvía 500 en toda la aplicación.
 */
export class RespuestaTruncada extends Error {
  constructor() {
    super('truncated');
    this.name = 'RespuestaTruncada';
  }
}
