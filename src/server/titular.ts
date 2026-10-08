/**
 * Quién publica esta copia, para el aviso legal y la política de privacidad.
 *
 * **No se escribe en el código: sale del entorno**, y si falta, las páginas lo
 * dicen en vez de inventarlo. Un NIF de ejemplo en un aviso legal publicado es
 * peor que ninguno: parece cumplir y no identifica a nadie
 * ([adr/0111](../../docs/adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).
 *
 * Son datos públicos —la LSSI obliga a enseñarlos— pero **sin `NEXT_PUBLIC_`**:
 * esas se escriben dentro del paquete al construir, y el camino del contenedor
 * construye sin variables y arranca con ellas (`docs/DESPLIEGUE.md`). Leídas aquí,
 * en el servidor y en cada petición, valen las del arranque.
 */

/** Lo que pide el art. 10 de la LSSI-CE, más quién aloja el servidor. */
export interface Titular {
  /** Nombre y apellidos, o la denominación social. */
  readonly nombre: string | null;
  readonly nif: string | null;
  /** Domicilio: una dirección postal donde se le pueda escribir. */
  readonly domicilio: string | null;
  /** Correo para el aviso legal y para ejercer los derechos del RGPD. */
  readonly correo: string | null;
  /**
   * Quién aloja el servidor y dónde, en una frase —«Hetzner Online GmbH,
   * Alemania»—. Guarda registros de acceso aunque la aplicación no guarde
   * ninguno, así que la política de privacidad tiene que nombrarlo.
   */
  readonly alojamiento: string | null;
}

/** Las variables, y qué dato es cada una. Lo usan la página y su test. */
const VARIABLES_DEL_TITULAR = {
  nombre: 'TITULAR_NOMBRE',
  nif: 'TITULAR_NIF',
  domicilio: 'TITULAR_DOMICILIO',
  correo: 'TITULAR_CORREO',
  alojamiento: 'TITULAR_ALOJAMIENTO',
} as const satisfies Record<keyof Titular, string>;

function leer(nombre: string): string | null {
  const valor = process.env[nombre]?.trim();
  return valor === undefined || valor === '' ? null : valor;
}

export function titular(): Titular {
  return {
    nombre: leer(VARIABLES_DEL_TITULAR.nombre),
    nif: leer(VARIABLES_DEL_TITULAR.nif),
    domicilio: leer(VARIABLES_DEL_TITULAR.domicilio),
    correo: leer(VARIABLES_DEL_TITULAR.correo),
    alojamiento: leer(VARIABLES_DEL_TITULAR.alojamiento),
  };
}

/** Las variables que faltan, por su nombre: es lo que hay que ir a poner. */
export function loQueFalta(datos: Titular): readonly string[] {
  return (Object.keys(VARIABLES_DEL_TITULAR) as (keyof Titular)[])
    .filter((campo) => datos[campo] === null)
    .map((campo) => VARIABLES_DEL_TITULAR[campo]);
}
