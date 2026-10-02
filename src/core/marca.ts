/**
 * Quitarle a un texto libre la marca que lo encierra en el prompt.
 *
 * Los dos textos libres que llegan al modelo —la pregunta al profesor y las
 * directrices de una salida— van entre marcas (`###PREGUNTA###`,
 * `###DIRECTRICES###`), y el prompt de sistema dice que lo de dentro es un dato.
 * Si quien escribe pudiera poner la marca, cerraría el bloque y lo de después se
 * leería como instrucciones nuestras. Por eso se borra antes de que llegue.
 *
 * **Y borrar solo la marca exacta no bastaba**: la auditoría la saltó de cuatro
 * maneras y el modelo se las creyó todas menos una —con espacios
 * (`### PREGUNTA ###`), en minúsculas, con un espacio de ancho cero dentro de la
 * palabra y con almohadillas de ancho completo (`＃＃＃`)—. Para el modelo las
 * cuatro son la marca; para un `split` de la cadena exacta, ninguna. Así que
 * primero se normaliza lo que se escribe y luego se busca **cualquier forma** de
 * la marca, no una.
 *
 * Vive en `core/` porque lo usan los dos contratos y un feature no importa de
 * otro, y porque dos maneras de acotar lo mismo serían dos superficies que revisar.
 */

/**
 * Lo escrito, en una forma sin trampas visuales.
 *
 * - **NFKC**, que convierte las formas de compatibilidad en la letra de siempre:
 *   `＃` de ancho completo en `#`, `ＰＲＥＧＵＮＴＡ` en `PREGUNTA`.
 * - **Fuera los caracteres de formato** (`\p{Cf}`): el espacio de ancho cero, los
 *   que unen o separan letras, las marcas de dirección. No se ven, y su único uso
 *   en una pregunta de música es partir una palabra para que no la encuentre una
 *   búsqueda.
 * - **Los de control se vuelven espacios** (`\p{Cc}`), menos el salto de línea,
 *   que alguien puede escribir de verdad entre dos frases.
 */
export function textoVisible(texto: string): string {
  return texto
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/[^\S\n ]|(?!\n)\p{Cc}/gu, ' ');
}

/**
 * Cualquier forma de la marca: dos o más almohadillas, la palabra y otras dos o
 * más, con espacios o sin ellos y en mayúsculas o en minúsculas. **Y cualquiera de
 * sus dos mitades**: `PREGUNTA###` a secas ya se lee como un cierre. El sostenido
 * musical (`♯`) entra también: NFKC no lo convierte en `#` y a la vista es lo
 * mismo, y dos seguidos no se escriben en una pregunta de música.
 */
function patronDe(palabra: string): RegExp {
  const almohadillas = '[#♯]{2,}';
  return new RegExp(
    `${almohadillas}\\s*${palabra}(?:\\s*${almohadillas})?|${palabra}\\s*${almohadillas}`,
    'giu',
  );
}

/**
 * El texto visible y sin ninguna forma de la marca de esa palabra.
 *
 * La marca se cambia por un espacio y no por nada, y se repite hasta que no
 * quede: quitarla no puede juntar dos trozos en una marca nueva.
 */
export function sinMarca(texto: string, palabra: string): string {
  const patron = patronDe(palabra);
  let actual = textoVisible(texto);
  for (;;) {
    const siguiente = actual.replace(patron, ' ');
    if (siguiente === actual) {
      return actual;
    }
    actual = siguiente;
  }
}
