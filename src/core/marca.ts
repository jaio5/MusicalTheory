/**
 * El texto libre que llega al modelo: cómo se marca, cómo se le quita lo que imita
 * la marca y cuánto puede ocupar.
 *
 * Los dos textos libres que llegan al modelo —la pregunta al profesor y las
 * directrices de una salida— van entre marcas, y el prompt de sistema dice que lo
 * de dentro es un dato. Si quien escribe pudiera poner la marca, cerraría el bloque
 * y lo de después se leería como instrucciones nuestras.
 *
 * **La defensa de verdad es que la marca no se puede adivinar** (adr/0115): cada
 * petición lleva su clave aleatoria, `###PREGUNTA-3f9a1c###`, y el prompt de sistema
 * dice que el bloque solo lo cierra la misma marca con la misma clave. Quien escribe
 * no la ve nunca, así que no la puede escribir. Borrar lo que se le parece fue la
 * defensa hasta entonces, y la auditoría del 7 de octubre de 2026 la saltó siete
 * veces más —un selector de variante detrás de cada `#`, un acento combinado, letras
 * cirílicas y griegas, un relleno hangul invisible, una sola almohadilla— y
 * `qwen3:8b` se las creyó; ahora es la segunda capa, y busca sobre una copia sin
 * esos disfraces (`copiaParaBuscar`).
 *
 * Vive en `core/` porque lo usan los dos contratos y un feature no importa de
 * otro, y porque dos maneras de acotar lo mismo serían dos superficies que revisar.
 */

/**
 * Caracteres por token en español, a la baja: la misma cuenta que usan las pruebas
 * del presupuesto (`server/prompts.test.ts`, `app/api/salidas/presupuesto.test.ts`).
 */
export const CARACTERES_POR_TOKEN = 3.2;

/**
 * Lo escrito, en una forma sin trampas visuales.
 *
 * - **NFKC**, que convierte las formas de compatibilidad en la letra de siempre:
 *   `＃` de ancho completo en `#`, `ＰＲＥＧＵＮＴＡ` en `PREGUNTA`.
 * - **Fuera los caracteres de formato** (`\p{Cf}`): el espacio de ancho cero, los
 *   que unen o separan letras, las marcas de dirección. No se ven, y su único uso
 *   en una pregunta de música es partir una palabra para que no la encuentre una
 *   búsqueda. **Y las mitades sueltas de un par sustituto** (`\p{Cs}`), que salen de
 *   cortar una cadena por la mitad de un emoji y no son ningún carácter.
 * - **Los de control se vuelven espacios** (`\p{Cc}`), menos el salto de línea,
 *   que alguien puede escribir de verdad entre dos frases.
 *
 * Cada expresión mira un carácter y sigue: lineal en lo que mide el texto.
 */
export function textoVisible(texto: string): string {
  return texto
    .normalize('NFKC')
    .replace(/[\p{Cf}\p{Cs}]/gu, '')
    .replace(/[^\S\n ]|(?!\n)\p{Cc}/gu, ' ');
}

/**
 * Lo que no se ve y no es de formato: los rellenos hangul (`U+3164` y sus primos,
 * que son letras para Unicode), el braille vacío y los dos de jemer que se pintan
 * sin nada. Partían la palabra de la marca sin que `\p{Cf}` los viera.
 */
const INVISIBLES = new Set([0x115f, 0x1160, 0x17b4, 0x17b5, 0x2800, 0x3164, 0xffa0]);

/**
 * La tabla mínima de letras que se confunden con las latinas, **en minúscula**: la
 * copia se pasa a minúsculas antes de mirarla. Cirílicas y griegas, que son las que
 * usó la auditoría (`PRЕGUNTА`, `ΡRΕGUNTΑ`), más el punto ideográfico, que escribe
 * un dominio sin que se vea el punto. No pretende ser la de Unicode entera: cubre
 * las letras de las dos marcas y de un dominio, que es lo que se busca aquí.
 */
const PARECIDAS: Readonly<Record<string, string>> = {
  // Cirílicas.
  а: 'a',
  в: 'b',
  е: 'e',
  һ: 'h',
  і: 'i',
  ј: 'j',
  к: 'k',
  ӏ: 'l',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  ԛ: 'q',
  ѕ: 's',
  с: 'c',
  т: 't',
  у: 'y',
  ԝ: 'w',
  х: 'x',
  ԁ: 'd',
  // Griegas.
  α: 'a',
  β: 'b',
  ε: 'e',
  η: 'h',
  ι: 'i',
  κ: 'k',
  μ: 'm',
  ν: 'n',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  ζ: 'z',
  ϲ: 'c',
  // Latinas que no son la de siempre.
  ı: 'i',
  ɡ: 'g',
  ɑ: 'a',
  // El punto ideográfico.
  '。': '.',
};

/** Una marca combinada: un acento suelto, un selector de variante, la tecla `U+20E3`. */
const COMBINADA = /^\p{M}$/u;

/** Un carácter, tal y como se busca: en minúscula, sin acentos ni disfraz. */
function plegar(caracter: string): string {
  const codigo = caracter.codePointAt(0)!;
  // Lo de siempre, deprisa: es casi todo lo que se escribe.
  if (codigo < 0x80) {
    return caracter.toLowerCase();
  }
  if (INVISIBLES.has(codigo) || COMBINADA.test(caracter)) {
    return '';
  }
  // **Lo que se descompone en letra y acento vive por debajo de `U+2000`**: latinas,
  // griegas y cirílicas con su tilde. Lo de más arriba —CJK, yi, emoji— no lleva
  // nada que quitar, y descomponerlo carácter a carácter era lo que más pesaba en
  // un texto de 128 KB.
  if (codigo >= 0x2000) {
    return PARECIDAS[caracter] ?? caracter;
  }
  let plegado = '';
  for (const letra of caracter.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')) {
    plegado += PARECIDAS[letra] ?? letra;
  }
  return plegado;
}

/** La copia para buscar y, por cada unidad suya, de dónde a dónde viene en el original. */
interface Plegado {
  readonly copia: string;
  readonly desde: (unidad: number) => number;
  readonly hasta: (unidad: number) => number;
}

/** Todo ASCII: lo que se escribe casi siempre, y lo que se pliega sin mapa. */
const SOLO_ASCII = /^[\u0000-\u007f]*$/u;

/**
 * La copia de un texto visible que se usa para buscar, con el mapa de vuelta.
 *
 * **Lo que no deja nada en la copia** —un acento suelto, un selector de variante, un
 * relleno invisible— se suma a lo que va delante: así, borrar `#️` borra la
 * almohadilla y el selector que lleva pegado, y no deja el selector huérfano.
 *
 * Con todo ASCII la copia son las minúsculas y el mapa, la identidad: es lo que se
 * escribe casi siempre, y construir el mapa de 128 KB pesaba más que buscar en él.
 */
function plegado(visible: string): Plegado {
  if (SOLO_ASCII.test(visible)) {
    return { copia: visible.toLowerCase(), desde: (i) => i, hasta: (i) => i + 1 };
  }
  const trozos: string[] = [];
  const desde: number[] = [];
  const hasta: number[] = [];
  let posicion = 0;
  // Cada carácter distinto se pliega una vez: un texto largo repite casi todos.
  const plegados = new Map<string, string>();
  for (const caracter of visible) {
    const fin = posicion + caracter.length;
    let suyo = plegados.get(caracter);
    if (suyo === undefined) {
      suyo = plegar(caracter);
      plegados.set(caracter, suyo);
    }
    if (suyo === '' && hasta.length > 0) {
      hasta[hasta.length - 1] = fin;
    }
    for (let i = 0; i < suyo.length; i += 1) {
      desde.push(posicion);
      hasta.push(fin);
    }
    trozos.push(suyo);
    posicion = fin;
  }
  return { copia: trozos.join(''), desde: (i) => desde[i]!, hasta: (i) => hasta[i]! };
}

/**
 * Lo escrito tal y como se busca en ello: visible, en minúsculas, sin acentos ni
 * marcas combinadas (`\p{M}`: el selector de variante `U+FE0F`, el `U+034F`, la
 * tecla `U+20E3`), sin rellenos invisibles y con las letras cirílicas y griegas que
 * imitan a las latinas cambiadas por ellas.
 *
 * **Es solo para buscar**: lo que llega al modelo es `textoVisible`, con sus
 * tildes. Quitarle los acentos a una pregunta de música le cambia palabras.
 */
export function copiaParaBuscar(texto: string): string {
  return plegado(textoVisible(texto)).copia;
}

/** Lo que se parece a una almohadilla: la de siempre, el sostenido y la del teclado. */
const ALMOHADILLAS = '#♯⌗';

/**
 * Cualquier forma de la marca en la copia para buscar: una o más almohadillas, la
 * palabra y otras, con espacios o sin ellos. **Y cualquiera de sus dos mitades**:
 * `pregunta###` a secas ya se lee como un cierre. Basta una almohadilla: `#PREGUNTA#`
 * también se la creía el modelo.
 *
 * **Sin backtracking cuadrático.** La que había, `[#♯]{2,}\s*PALABRA`, probaba desde
 * cada almohadilla de una tira: cuarenta mil seguidas eran tres segundos y un cuerpo
 * de 128 KB, cuarenta y siete, con el hilo parado y sin cuenta. Ahora la primera
 * mitad solo empieza **al principio de la tira** —sin otra almohadilla detrás—, y
 * cada carácter se mira un número fijo de veces.
 */
function patronDe(palabra: string): RegExp {
  const tira = `[${ALMOHADILLAS}]+`;
  const p = palabra.toLowerCase();
  return new RegExp(`(?<![${ALMOHADILLAS}])${tira}\\s*${p}(?:\\s*${tira})?|${p}\\s*${tira}`, 'gu');
}

/**
 * Lo que queda donde había una marca. **No es un espacio**: un espacio dejaría
 * juntarse lo de un lado y lo del otro en una marca nueva —`## ` delante y
 * `PREGUNTA` detrás—, y había que repetir la búsqueda hasta que no quedara, que es
 * otra vez cuadrático. Un punto medio no es almohadilla, ni espacio, ni letra: nada
 * se junta a través de él, y basta una pasada.
 */
const EN_SU_LUGAR = '·';

/**
 * El texto visible y sin ninguna forma de la marca de esa palabra, escrita como se
 * escriba: con espacios, en minúsculas, con ancho cero o de ancho completo, con
 * acentos y selectores encima, con letras de otro alfabeto o con una almohadilla.
 *
 * Se busca en la copia plegada y se borra en el visible, con el mapa que las une.
 * Una pasada, lineal.
 */
export function sinMarca(texto: string, palabra: string): string {
  const visible = textoVisible(texto);
  const { copia, desde, hasta } = plegado(visible);
  let limpio = '';
  let cursor = 0;
  for (const encontrada of copia.matchAll(patronDe(palabra))) {
    limpio += visible.slice(cursor, desde(encontrada.index)) + EN_SU_LUGAR;
    cursor = hasta(encontrada.index + encontrada[0].length - 1);
  }
  return limpio + visible.slice(cursor);
}

/** Si en lo escrito queda alguna forma de la marca de esa palabra. */
export function tieneMarca(texto: string, palabra: string): boolean {
  return patronDe(palabra).test(copiaParaBuscar(texto));
}

/**
 * Seis cifras hexadecimales al azar, nuevas en cada petición: la clave de la marca.
 *
 * Veinticuatro bits, que son dieciséis millones de claves contra alguien que no ve
 * el prompt, tiene un cupo de peticiones y no sabe si ha acertado. Más cifras son
 * más tokens en cada pregunta, y el presupuesto del profesor va justo (adr/0100).
 * Con `crypto`, que tienen el navegador y Node sin importar nada.
 */
export function claveAleatoria(): string {
  const bytes = new Uint8Array(3);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** La marca de esa palabra con esa clave: `###PREGUNTA-3f9a1c###`. */
export function marcaConClave(palabra: string, clave: string): string {
  return `###${palabra}-${clave}###`;
}

/**
 * El texto entre sus dos marcas, con una clave que no aparece en él.
 *
 * La clave es nueva en cada llamada y el texto ya no tiene nada con forma de marca,
 * así que coincidir sería un acierto de uno entre dieciséis millones; aun así se
 * comprueba, porque comprobarlo es una línea y suponerlo es una frase en un ADR.
 */
export function entreMarcas(
  texto: string,
  palabra: string,
  clave: () => string = claveAleatoria,
): string {
  let suya = clave();
  while (texto.includes(suya)) {
    suya = clave();
  }
  const marca = marcaConClave(palabra, suya);
  return `${marca}\n${texto}\n${marca}`;
}

/**
 * Los tokens que puede costar un texto **en el peor alfabeto**.
 *
 * Los topes de la pregunta y de las directrices eran 240 unidades UTF-16, y el
 * presupuesto los contaba a 3,2 caracteres por token: 75. Con caracteres yi o CJK,
 * 240 son hasta 587 tokens, y de ese número salen los cupos (adr/0115). Así que
 * cada carácter paga lo que puede pesar:
 *
 * - **Lo latino** —ASCII y las letras latinas con tilde, hasta `U+024F`— a 3,2 por
 *   token, la misma cuenta que el resto del prompt y la que se midió en español.
 * - **Lo demás, un token por byte UTF-8**: el tokenizador trabaja por bytes, y un
 *   carácter no puede costar más tokens que bytes tiene. Dos para el griego y el
 *   cirílico, tres para el CJK y el yi, cuatro para un emoji.
 */
export function tokensEnElPeorCaso(texto: string): number {
  let tokens = 0;
  for (const caracter of texto) {
    tokens += costeDe(caracter);
  }
  return tokens;
}

function costeDe(caracter: string): number {
  const codigo = caracter.codePointAt(0)!;
  if (codigo <= 0x024f) {
    return 1 / CARACTERES_POR_TOKEN;
  }
  return codigo <= 0x7ff ? 2 : codigo <= 0xffff ? 3 : 4;
}

/**
 * El principio de un texto que cabe en ese tope de tokens del peor caso, cortado
 * por un carácter entero y nunca por la mitad de un emoji.
 *
 * El tope se da en **letras latinas**, que es como se leen los de `core/billing`:
 * 240 son 240 letras de una pregunta en español, o 25 caracteres chinos.
 */
export function recortarALetras(texto: string, letras: number): string {
  const tope = letras / CARACTERES_POR_TOKEN;
  let tokens = 0;
  let corte = 0;
  for (const caracter of texto) {
    tokens += costeDe(caracter);
    // Con una milésima de margen: sumar tercios en coma flotante no da exacto.
    if (tokens > tope + 1e-9) {
      return texto.slice(0, corte);
    }
    corte += caracter.length;
  }
  return texto;
}

/**
 * Cuánto se lee de lo que llega antes de limpiarlo, en unidades UTF-16.
 *
 * **Se recorta antes de limpiar**, y no después como se hacía: limpiar es recorrer
 * el texto, y un cuerpo de 128 KB se recorría entero para quedarse con 240. Cuatro
 * veces el tope deja sitio de sobra a lo que la limpieza quita —invisibles, marcas,
 * espacios— sin que quien escribe pueda empujar lo suyo más allá con relleno.
 */
const LEIDO_POR_LETRA = 4;

/**
 * El texto libre listo para el prompt: recortado antes de nada, sin la marca, sin
 * espacios de sobra y dentro de su tope de letras (`recortarALetras`). Vacío si no
 * queda nada.
 */
export function textoLibre(crudo: string, palabra: string, letras: number): string {
  const limpio = sinMarca(crudo.slice(0, letras * LEIDO_POR_LETRA), palabra).trim();
  return recortarALetras(limpio, letras).trim();
}
