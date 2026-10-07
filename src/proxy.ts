import { NextResponse, type NextRequest } from 'next/server';

/**
 * Las cabeceras de seguridad, y el número de un solo uso que hace que la CSP
 * sirva de algo.
 *
 * Esta aplicación no carga **nada de fuera**: ni un guion, ni una hoja, ni una
 * fuente, ni una imagen, ni una petición —comprobado recorriendo las cinco
 * pantallas con el navegador—. Lo único que viaja fuera son símbolos a la ruta
 * de la IA, y eso lo hace el servidor. Así que la política puede ser `'self'` y
 * nada más, que es lo más apretado que se puede pedir.
 *
 * **El número va en la cabecera y no `'unsafe-inline'`.** Con `'unsafe-inline'`
 * la política deja de proteger de lo único de lo que protege una CSP: que
 * alguien consiga meter un `<script>` en la página. Aquí hay guiones en línea
 * —el del tema, que aplica el color antes de pintar, y los que Next escribe para
 * ir enviando la página a trozos—, así que hacen falta un número por petición y
 * un `strict-dynamic` para lo que esos guiones carguen después.
 *
 * Next reparte el número solo: al ver uno en la cabecera se lo pone a sus
 * guiones. Al nuestro se lo ponemos en `layout.tsx`, leyendo esta cabecera.
 *
 * `style-src` sí lleva `'unsafe-inline'`, y no es pereza: Tailwind y React
 * escriben estilos en el atributo `style` de los elementos —el ancho de un
 * bloque, el avance de una barra— y no hay número que valga para eso. Un estilo
 * inyectado puede afear la página; no puede ejecutar nada.
 */
function politica(numero: string, porHttps: boolean): string {
  /*
    `eval` solo mientras se desarrolla, y con una razón concreta.

    El servidor de desarrollo de Next evalúa código para recargar en caliente y
    para dibujar su panel de errores. Sin esto, `pnpm dev` llena la consola de
    quejas de la política en pantallas que en producción no se quejan —medido:
    el repaso—, y una consola con ruido es una consola que se deja de mirar.

    En lo que se sirve de verdad no entra: ahí no hay `eval` que valga.
  */
  const enDesarrollo = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${numero}' 'strict-dynamic'${enDesarrollo}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // El audio grabado se reproduce desde un `blob:` del propio equipo.
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    // Nada de `<object>`, `<embed>` ni applets, que no se usan.
    "object-src 'none'",
    // Ni formularios que salgan fuera, ni esta página metida en el marco de
    // otra: es lo que evita que alguien la enmarque y recoja las pulsaciones.
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // Que el navegador suba a https lo que se le haya colado en http. **Solo si
    // la página llegó por https**: servida por http desde otra dirección —el
    // Docker de casa abierto en el móvil, `http://192.168.1.20:3000`— pedía cada
    // guion y cada hoja por https a un servidor que no lo habla, y la portada se
    // quedaba sin dieciocho recursos con `ERR_SSL_PROTOCOL_ERROR`. En
    // `localhost` no se notaba porque el navegador lo exime.
    ...(porHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/**
 * Si quien mira la página la recibió por https.
 *
 * Tres maneras de saberlo, y vale cualquiera: la propia petición, la cabecera
 * que pone el proxy que hace el TLS —Caddy y Vercel la ponen solos; nginx, con
 * `proxy_set_header X-Forwarded-Proto $scheme`— y `APP_URL`, que dice cuál es la
 * dirección pública. La cabecera la puede escribir cualquiera, y da igual: lo
 * único que consigue quien mienta es romperse su propia página.
 */
export function llegaPorHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === 'https:') {
    return true;
  }
  // Con varios proxies en fila la cabecera trae una lista, y manda el primero:
  // es el que habló con el navegador.
  if (/^\s*https\s*(,|$)/i.test(request.headers.get('x-forwarded-proto') ?? '')) {
    return true;
  }
  return /^\s*https:/i.test(process.env['APP_URL'] ?? '');
}

/**
 * Se llama `proxy` y no `middleware` desde Next 16, que dejó el nombre viejo en
 * desuso: hace lo mismo y lo único que cambian son el fichero y la función
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 * Lo que sí cambia sin decirlo es dónde corre: `proxy` va en Node por defecto,
 * donde el viejo iba en el runtime de borde. Aquí no importa —lo único que usa es
 * `crypto.randomUUID`, que está en los dos—, y no se puede fijar: `runtime` en
 * este fichero es un error.
 */
export function proxy(request: NextRequest) {
  const numero = crypto.randomUUID().replaceAll('-', '');

  const entrada = new Headers(request.headers);
  entrada.set('x-nonce', numero);

  const respuesta = NextResponse.next({ request: { headers: entrada } });

  respuesta.headers.set('Content-Security-Policy', politica(numero, llegaPorHttps(request)));
  // El navegador no adivina el tipo de un fichero: si el servidor dice que es
  // texto, es texto, aunque parezca un guion.
  respuesta.headers.set('X-Content-Type-Options', 'nosniff');
  // Al salir a otro sitio se manda el dominio, no la dirección entera: por la
  // dirección se sabe qué unidad estabas estudiando.
  respuesta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Una ventana que abramos o que nos abra no se queda con un puntero a la otra:
  // sin esto, una página ajena abierta desde aquí podía leer `window.opener` y
  // mandar esta pestaña a otra dirección. Aquí no hay ventanas emergentes que lo
  // necesiten —el pago es una navegación entera, no un `window.open`—.
  respuesta.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  /*
    El micrófono, dicho en voz alta.

    Esta aplicación vive del micro, así que se declara; y se declara **solo** el
    micro, que es la manera de decir que la cámara, la ubicación y el resto no se
    piden nunca. Vale también para lo que se incruste dentro, que no hay nada.
  */
  respuesta.headers.set(
    'Permissions-Policy',
    'microphone=(self), camera=(), geolocation=(), payment=(), usb=()',
  );
  /*
    Y un año de https obligatorio. Por http el navegador se la salta, así que en
    el equipo de casa no estorba; publicando es lo que evita la primera visita
    en claro.
  */
  respuesta.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return respuesta;
}

/**
 * Todo menos lo que sirve Next por su cuenta.
 *
 * Los ficheros de `_next/static` se sirven ya construidos y con su propia caché;
 * pasarlos por aquí solo añade trabajo por petición sin cambiar nada de lo que
 * el navegador hace con ellos.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
