import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * El guardián de que las pantallas sigan pareciéndose entre sí.
 *
 * Esto no prueba comportamiento: lee los ficheros. Es a propósito, y es el mismo
 * truco que vigila que los tokens de diseño no se separen de su espejo en CSS. Lo
 * que se defiende aquí no se puede probar renderizando una pantalla suelta —cada
 * una se vería bien— sino comparándolas todas: **la coherencia solo se ve en
 * conjunto**, y es justo lo que se pierde a base de cambios que por separado
 * parecen razonables.
 *
 * Antes de esto había nueve pantallas con cinco anchos distintos, tres rellenos y
 * tres sin título ninguno.
 */
/**
 * El fichero sin sus líneas de comentario.
 *
 * Hace falta porque lo que se busca —`<select>`, `<details>`, un emoji— aparece
 * escrito en la documentación de los componentes que vinieron a sustituirlos.
 * Contarlo como incumplimiento castigaría justo al que lo explica.
 */
function sinComentarios(ruta: string): string {
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
    .join('\n');
}

/**
 * Todos los `.tsx` de producción, leídos **una vez** por fichero de test.
 *
 * Antes se recorría `src/` tres veces —dos funciones y un tercer recorrido
 * copiado dentro de un test— para responder tres preguntas sobre los mismos
 * datos: doscientas lecturas de fichero en cada `pnpm test`.
 */
const FICHEROS: ReadonlyArray<{ ruta: string; codigo: string }> = (() => {
  const raiz = join(process.cwd(), 'src');
  const salida: Array<{ ruta: string; codigo: string }> = [];

  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
      } else if (entrada.name.endsWith('.tsx') && !entrada.name.includes('.test.')) {
        salida.push({ ruta: ruta.replace(raiz, 'src'), codigo: sinComentarios(ruta) });
      }
    }
  };
  recorrer(raiz);
  return salida;
})();

/**
 * La clase de cada `<button>` y cada `<Link>`, sin las de lo que llevan dentro.
 *
 * El `className` propio es el primero que aparece tras la etiqueta. No se busca
 * el cierre del `>` porque no sirve: un `onClick={() => ...}` mete un `>` en
 * medio y cortaría la etiqueta por donde no es.
 */
function clasesDeControles(codigo: string): ReadonlyArray<string> {
  const salida: string[] = [];
  const apertura = /<(?:button|Link)\b/g;
  let encontrado: RegExpExecArray | null;

  while ((encontrado = apertura.exec(codigo)) !== null) {
    const trozo = codigo.slice(encontrado.index, encontrado.index + 600);
    const comillas = /className="([^"]*)"/.exec(trozo);
    const plantilla = /className=\{`([^`]*)`/.exec(trozo);

    const primero =
      comillas === null
        ? plantilla
        : plantilla === null
          ? comillas
          : comillas.index < plantilla.index
            ? comillas
            : plantilla;

    const clases = primero?.[1];
    if (clases !== undefined) {
      salida.push(clases);
    }
  }

  return salida;
}

/** Lo mismo, solo para los `<button>` escritos a mano: un `<Link>` puede ir en una frase. */
function clasesDeBotones(codigo: string): ReadonlyArray<string> {
  return clasesDeControles(codigo.replace(/<Link\b/g, '<enlace-de-next'));
}

/**
 * Las pantallas, y también las páginas que pintan la suya sin pasar por `screens/`.
 *
 * `/planes/[plan]` y `/olvidada` se escribían dentro de su `page.tsx`, y por eso
 * ningún guardián las veía: la ventana de pago llevaba el `h1` en otra letra, la
 * columna centrada y las esquinas cuadradas, y las nueve verdes. Una página cuenta
 * como pantalla cuando vive bajo el marco común —el grupo `(marco)`, que pone
 * `AppShell` en su layout— y **no** delega en una de `screens/`.
 */
function pantallas(): ReadonlyArray<{ nombre: string; codigo: string }> {
  return FICHEROS.filter(
    ({ ruta, codigo }) =>
      (ruta.includes('/screens/') && ruta.endsWith('Screen.tsx')) ||
      (ruta.startsWith('src/app/(marco)/') &&
        ruta.endsWith('/page.tsx') &&
        !/\/screens\//.test(codigo)),
  ).map(({ ruta, codigo }) => ({
    nombre: ruta.endsWith('/page.tsx')
      ? ruta.replace('src/app/(marco)/', '')
      : ruta.split('/').pop()!,
    codigo,
  }));
}

describe('Todas las pantallas', () => {
  it('hay pantallas sueltas en páginas, y el guardián las ve', () => {
    const nombres = pantallas().map(({ nombre }) => nombre);

    expect(nombres).toContain('planes/[plan]/page.tsx');
    expect(nombres).toContain('olvidada/page.tsx');
  });

  it('usan el marco común, y ninguna se inventa el suyo', () => {
    for (const { nombre, codigo } of pantallas()) {
      expect(codigo, nombre).toMatch(/from '@ui\/Screen'/);
    }
  });

  /**
   * Un `h1` a mano dentro de una pantalla es un segundo título compitiendo con el
   * del marco, y es como aparecieron los dos que tenían la cuenta y el repaso.
   */
  it('no escriben su propio h1 por debajo del marco', () => {
    for (const { nombre, codigo } of pantallas()) {
      expect(codigo.includes('<h1'), `${nombre} escribe un h1 a mano`).toBe(false);
    }
  });

  /**
   * El relleno de página lo pone el marco. Que una pantalla lo escriba otra vez es
   * exactamente como volvieron a separarse: tres rellenos distintos y ninguno mal
   * a primera vista.
   *
   * **El relleno se lee de `Screen.tsx`, no se copia aquí.** Escrito a mano, el día
   * que el marco pase a `p-5 md:p-10` este test se queda en verde para siempre
   * vigilando una cadena que ya no usa nadie, que es el peor modo de fallo de un
   * guardián: el falso verde silencioso.
   */
  it('no se escriben su propio contenedor de página', () => {
    const marco = readFileSync(join(process.cwd(), 'src/ui/Screen.tsx'), 'utf8');
    // El relleno va en la caja de fuera, la que se centra igual para los dos
    // anchos (`ui/Screen`): es lo que hace que todos los títulos empiecen en el
    // mismo borde. Se leen las dos mitades de la caja —su techo (`max-w-…`) y su
    // relleno— sin escribir ninguna aquí, por lo mismo de arriba: la caja pasó de
    // `max-w-7xl` y cuatro escalones de relleno a `max-w-pantalla px-margen`, y
    // con la cadena copiada este test se habría quedado ciego.
    // El orden de las clases lo decide Prettier —pone delante las utilidades
    // propias—, así que la caja se busca por lo que es y no por cómo se escribe:
    // la que se centra (`mx-auto`) con su techo (`max-w-…`).
    const caja = [...marco.matchAll(/className="([^"]+)"/g)]
      .map((m) => m[1]!.split(/\s+/))
      .find((clases) => clases.includes('mx-auto') && clases.some((c) => c.startsWith('max-w-')));
    const techo = caja?.find((c) => c.startsWith('max-w-'));
    const relleno = caja?.filter((c) => /^(?:[a-z]+:)?p[xytblr]?-/.test(c)) ?? [];

    expect(techo, 'no se ha podido leer el techo de Screen.tsx').toBeTruthy();
    expect(relleno.length, 'no se ha podido leer el relleno de Screen.tsx').toBeGreaterThan(1);

    for (const { nombre, codigo } of pantallas()) {
      const clasesDeLaPantalla = [...codigo.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`)/g)].map(
        (m) => (m[1] ?? m[2]!).split(/\s+/),
      );
      // El relleno entero en una misma caja: eso es escribirse el contenedor.
      expect(
        clasesDeLaPantalla.some((clases) => relleno.every((r) => clases.includes(r))),
        `${nombre} se escribe el relleno del marco (${relleno.join(' ')})`,
      ).toBe(false);
      // El techo de la pantalla es del marco: una pantalla que lo escribe está
      // montando otra caja centrada, que es como volvió a saltar el título.
      expect(
        clasesDeLaPantalla.some((clases) => clases.includes(techo!)),
        `${nombre} se escribe el techo del marco (${techo})`,
      ).toBe(false);
    }
  });
});

/**
 * «Desplegable» son dos controles distintos —el de elegir una opción y el que
 * abre un trozo de pantalla— y cada uno tiene un componente. Escritos a pelo
 * vuelven a salir cinco: había tres `<select>` sueltos con tres rellenos y tres
 * `<details>` sin una sola flecha entre los tres.
 */
describe('Los desplegables', () => {
  it('el de elegir una opción es siempre ui/Field', () => {
    const sueltos = FICHEROS.filter(({ ruta }) => !ruta.endsWith('ui/Field.tsx'))
      .filter(({ codigo }) => codigo.includes('<select'))
      .map(({ ruta }) => ruta);

    expect(sueltos).toEqual([]);
  });

  it('el que abre un trozo de pantalla es siempre ui/Disclosure', () => {
    const sueltos = FICHEROS.filter(({ ruta }) => !ruta.endsWith('ui/Disclosure.tsx'))
      .filter(({ codigo }) => codigo.includes('<details'))
      .map(({ ruta }) => ruta);

    expect(sueltos).toEqual([]);
  });

  /**
   * Y la única excepción, con su sitio cerrado: lo que se abre **desde una fila
   * que se desplaza** es un `popover` del navegador, porque el panel de un
   * `Disclosure` se ancla dentro de la fila y ella misma lo recorta
   * ([adr/0065](../../../docs/adr/0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md)).
   * Hoy esa fila es la barra compacta de componer. Un `popover` en otro sitio es
   * un `Disclosure` que se ha saltado la regla.
   */
  it('el popover solo vive en la fila que se desplaza', () => {
    const DONDE_VALE = new Set([
      'src/app/screens/ComposeScreen.tsx',
      'src/features/metronome/Metronome.tsx',
    ]);
    const fuera = FICHEROS.filter(({ codigo }) => /\bpopover=/.test(codigo))
      .map(({ ruta }) => ruta)
      .filter((ruta) => !DONDE_VALE.has(ruta));

    expect(fuera).toEqual([]);
  });

  /**
   * El tercero de la familia, y el que más tardó en tenerlo.
   *
   * Los campos de escribir estuvieron a mano en catorce sitios, con la misma
   * cadena de clases copiada, y ya habían divergido en dos variantes. Lo que la
   * duplicación escondía era peor que la duplicación: **ninguna de las catorce
   * llegaba a los 44 px** que esta aplicación exige en todo lo que se pulsa, y
   * nadie lo vio porque no había un sitio donde mirarlo.
   *
   * Se busca la cadena de clases y no `<input`, porque hay entradas que no son
   * campos de formulario —un buscador dentro de una barra de herramientas, una
   * casilla— y forzarlas a este molde las estropearía.
   */
  it('el de escribir algo es siempre ui/TextField', () => {
    const sueltos = FICHEROS.filter(({ ruta }) => !ruta.endsWith('ui/TextField.tsx'))
      .filter(({ codigo }) => codigo.includes('border-border bg-background text-text rounded-md'))
      .map(({ ruta }) => ruta);

    expect(sueltos).toEqual([]);
  });
});

describe('Lo que no puede escaparse de la pantalla', () => {
  /**
   * Las etiquetas `sr-only` de Tailwind son `position: absolute`, y un absoluto
   * **sin ancestro posicionado se ancla al documento**. Las de la lista de
   * acordes viven dentro de un contenedor con scroll, así que su posición
   * estática cae muy por debajo de lo que se ve: se escapaban del
   * `overflow-hidden` y estiraban la página casi mil píxeles. La aplicación se
   * iba hacia arriba y debajo quedaba una franja negra vacía.
   *
   * Se descubrió mirando la pantalla con el navegador, no con un test: ningún
   * test de los que hay podía verlo. El arreglo es una palabra —`relative` en el
   * contenedor de la aplicación— y esto es lo que impide que se caiga sin que
   * nadie se entere.
   */
  it('el marco de la aplicación ancla los absolutos que lleva dentro', () => {
    const shell = FICHEROS.find(({ ruta }) => ruta.endsWith('app/AppShell.tsx'));

    expect(shell, 'no se encuentra AppShell').toBeTruthy();
    expect(shell!.codigo).toMatch(/className="[^"]*\brelative\b[^"]*\bh-dvh\b/);
  });

  /**
   * Y recorta con `overflow-clip`, que **no es lo mismo que `overflow-hidden`**.
   *
   * `hidden` quita la barra de desplazamiento pero la caja sigue siendo
   * desplazable por código: un `scrollIntoView` de dentro —el que trae a la
   * vista el acorde recién puesto— sube el marco entero, y no hay nada que lo
   * baje. Medido en una ventana de 700×600 con una canción escrita: la sala se
   * iba 183 px, la cabecera y la barra de pantallas desaparecían por arriba y
   * debajo quedaba una franja negra. `clip` no es un contenedor de
   * desplazamiento, así que no hay nada que subir.
   *
   * Se vigila aquí porque es una palabra, se pierde en cualquier retoque, y lo
   * que rompe no lo ve ningún test de los que hay: se ve mirando la pantalla, o
   * con la sonda del skill `arrancar`.
   */
  it('y recorta sin dejarse desplazar', () => {
    const shell = FICHEROS.find(({ ruta }) => ruta.endsWith('app/AppShell.tsx'));

    expect(shell!.codigo, 'el marco no puede llevar overflow-hidden').not.toMatch(
      /className="[^"]*\bh-dvh\b[^"]*\boverflow-hidden\b/,
    );
    expect(shell!.codigo).toMatch(/className="[^"]*\bh-dvh\b[^"]*\boverflow-clip\b/);
  });

  /**
   * La barra de tonalidad tiene que flotar, no empujar.
   *
   * Es el fallo más caro de esta pantalla y ha vuelto dos veces con dos caras
   * distintas, las dos por lo mismo: la barra vive encima de una caja que crece,
   * y si lo que se abre reparte altura con ella no hay reparto bueno. Empujando
   * sin ceder, a la de abajo le tocaban **doce píxeles** y lo que quedaba no se
   * alcanzaba ni desplazándose; cediendo, la rueda salía **cortada por una
   * recta**, que no se lee como «hay más» sino como que algo se ha roto.
   *
   * Flotando no hay nada que repartir. Se vigila aquí porque es una palabra en un
   * fichero y se pierde en cualquier retoque, y porque lo que rompe no lo ve
   * ningún test de los que hay: se ve mirando la pantalla.
   */
  it('lo que abre la barra de tonalidad flota, en vez de quitarle sitio a lo de abajo', () => {
    const barra = FICHEROS.find(({ ruta }) => ruta.endsWith('wheel/BarraDeTonalidad.tsx'));

    expect(barra, 'no se encuentra BarraDeTonalidad').toBeTruthy();
    expect(barra!.codigo, 'la barra tiene que abrirse flotando').toMatch(/^\s*flotante\s*$/m);
  });

  /**
   * Y quien la monta no la encoge.
   *
   * Una barra que flota mide su rótulo y no compite por el alto con nadie, así
   * que dejarla encoger solo sirve para que el flexbox le aplaste el rótulo
   * cuando lo de abajo pida sitio. Medido: con `min-h-0` se quedaba en 24 px.
   */
  it('y quien la monta la deja a su alto, sin encogerla', () => {
    const montadas = FICHEROS.filter(({ codigo }) => codigo.includes('<BarraDeTonalidad'));

    expect(montadas.length, 'nadie monta la barra de tonalidad').toBeGreaterThan(0);

    for (const { ruta, codigo } of montadas) {
      // Hasta el cierre de la etiqueta y **ni un carácter más**: con un margen
      // por detrás, la última clase que se encuentra es la de algo de dentro y
      // el test pasa siempre. Comprobado devolviendo el fallo a mano.
      const inicio = codigo.indexOf('<BarraDeTonalidad');
      const hasta = codigo.slice(0, codigo.indexOf('>', inicio));
      const clases = [...hasta.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
        (m) => m[1] ?? m[2] ?? '',
      );
      const marco = clases.at(-1) ?? '';

      expect(marco, `${ruta}: no encuentro el marco de la barra`).not.toBe('');
      expect(marco, `${ruta}: con min-h-0 el flexbox le aplasta el rótulo`).not.toMatch(
        /\bmin-h-0\b/,
      );
      expect(marco, `${ruta}: una barra que flota se queda a su alto`).toMatch(/\bshrink-0\b/);
    }
  });
});

describe('En toda la interfaz', () => {
  /**
   * La mitad que le falta a `ui/tokens.test.ts`.
   *
   * Allí se comprueba que todo color con el que se escribe llega a 4,5:1 sobre
   * los tres fondos, y tres tokens quedan fuera de esa lista porque no son para
   * escribir: `oxblood` y `tube` son relleno —el tapizado del botón de escuchar,
   * la barra de lo que llevas hecho— y `brassDim` es adorno. Sobre el negro del
   * tema de casa, el más legible de los tres se queda en 2,8:1.
   *
   * Sin este test, esa exclusión sería una puerta abierta: bastaría escribir
   * `text-tube` una vez para tener un texto por debajo del mínimo con los dos
   * guardianes en verde. Aquí se cierra por el otro lado —que no se usen donde
   * no valen— y las dos mitades juntas son la regla entera.
   *
   * Se mira `text-` y nada más. `fill-` y `stroke-` quedan fuera a propósito:
   * en un SVG pintan las letras con el mismo prefijo con el que pintan las
   * formas, y las formas sí pueden llevar estos colores —el trazo de la
   * mascota y el contorno de las notas del mástil son adorno de pleno
   * derecho—. Meterlos aquí daría dos incumplimientos falsos y acabaría con el
   * test desactivado, que es peor que no tenerlo.
   */
  it('no se escribe con los colores que son relleno o adorno', () => {
    const prohibidos = /\btext-(?:tube|oxblood|brass-dim)\b(?!-)/;

    const pendientes = FICHEROS.filter(({ codigo }) => prohibidos.test(codigo)).map(
      ({ ruta }) => ruta,
    );

    expect(pendientes).toEqual([]);
  });

  /**
   * Cuarenta y cuatro píxeles, y no solo donde ya se miraba.
   *
   * `ESTILO.md` lo dice desde el principio —«44 px de alto en todo lo que se
   * pulsa»— y `ui/Button`, `ui/Chip` y `ui/TextField` lo cumplen desde que
   * existen. Lo que nadie vigilaba eran los controles **redondos**, que no pasan
   * por esos tres componentes porque no tienen texto: el conmutador de tema y los
   * dos botones de la cuenta medían 36 px y el de grabar 32, los tres al lado de
   * uno de 44 en la misma barra. Y los enlaces de la barra de pantallas se
   * quedaban en 26 desde los 640 px de ancho, que es donde entran las tabletas.
   *
   * Se lee la clase **propia** del control y no la de lo que lleva dentro: un
   * icono de `size-5` dentro de un botón de `size-tap` está bien, y mirar el
   * bloque entero lo daría por malo. De ahí que se busque el primer `className`
   * después de la etiqueta y se pare ahí.
   *
   * Fuera quedan los tamaños entre corchetes y los que no son un número —`h-full`,
   * `size-tap`—: el primero es una excepción escrita a mano que quien la escribe
   * está viendo, y el segundo es justo lo que se pide.
   */
  it('nada de lo que se pulsa mide menos de 44 px', () => {
    // 11 en la escala de Tailwind son los 44 px de `--spacing-tap`.
    const MINIMO = 11;
    const pendientes: string[] = [];

    for (const { ruta, codigo } of FICHEROS) {
      for (const clases of clasesDeControles(codigo)) {
        for (const [, medida] of clases.matchAll(/\b(?:size|h)-(\d+)\b/g)) {
          if (Number(medida) < MINIMO) {
            pendientes.push(`${ruta}: ${clases.trim().slice(0, 60)}`);
          }
        }
      }
    }

    expect(pendientes).toEqual([]);
  });

  /**
   * **Y el que no dice ningún alto también cuenta.**
   *
   * El de arriba solo ve lo que se declara pequeño —un `h-8`, un `size-6`—, y un
   * `<button>` a mano sin ningún alto se le escapaba entero: la «×» de
   * `sessions/ResumeLast` llevaba `px-2 text-sm` y medía veinte píxeles de alto
   * con este test en verde. Aquí se pide que cada `<button>` escrito a mano diga
   * su alto —`min-h-tap`, `size-tap`, `h-full` si lo pone el padre—.
   *
   * Se libran tres casos que no son descuido: los que componen su clase desde
   * una constante —`ui/Button`, que ya la mide—, los `.enlace` —una palabra
   * dentro de una frase, que WCAG 2.5.8 exime— y los `absolute`, que cubren la
   * caja de su padre y miden lo que mide ella.
   *
   * `YA_ESTABAN` son los que había al escribir esto, en zonas que no eran de
   * quien lo escribió: **la lista solo puede encoger**. Uno nuevo falla aquí.
   */
  it('todo botón a mano dice su alto', () => {
    const YA_ESTABAN = new Set([
      'src/app/screens/ComposeScreen.tsx',
      'src/features/learn/Tutor.tsx',
      'src/features/path/ChordSearch.tsx',
      'src/ui/Area.tsx',
    ]);
    const pendientes: string[] = [];

    for (const { ruta, codigo } of FICHEROS) {
      if (YA_ESTABAN.has(ruta)) {
        continue;
      }
      for (const clases of clasesDeBotones(codigo)) {
        if (clases.startsWith('${') || /\b(?:enlace|absolute)\b/.test(clases)) {
          continue;
        }
        if (!/\b(?:min-h|h|size)-/.test(clases)) {
          pendientes.push(`${ruta}: ${clases.trim().slice(0, 60)}`);
        }
      }
    }

    expect(pendientes).toEqual([]);
  });

  /**
   * La letra de un botón la pone el botón, con `tamano`, y no quien lo usa.
   *
   * En una sola pantalla de componer convivían botones de 12, 14 y 16 px con el
   * mismo alto: quince pasaban `text-xs` en `className` porque en su fila no
   * cabían, y vista de lejos la barra parecía hecha en tres sitios distintos.
   * `ui/Button` y `ui/Chip` tienen ahora `tamano="compacto"`, y 12 px no es
   * ninguno de los dos: un mando que se pulsa con la guitarra puesta no se lee a
   * esa letra.
   *
   * Se mira desde cada `<Button` o `<Chip` hasta la siguiente etiqueta, que es
   * donde caben sus atributos aunque ocupen varias líneas.
   */
  it('ningún botón ni pastilla baja la letra con text-xs', () => {
    const pendientes: string[] = [];

    for (const { ruta, codigo } of FICHEROS) {
      for (const etiqueta of codigo.matchAll(/<(?:Button|Chip)\b[^<]*/g)) {
        if (/className=[^]*?\btext-xs\b/.test(etiqueta[0])) {
          pendientes.push(`${ruta}: ${etiqueta[0].trim().slice(0, 60)}`);
        }
      }
    }

    expect(pendientes).toEqual([]);
  });

  /**
   * Los relieves salen de la paleta, no de un `rgba` escrito dentro de una clase.
   *
   * Es el agujero que `ui/tokens.test.ts` **no puede tapar**: aquel compara la
   * paleta con su espejo en CSS, y un número dentro de una cadena de Tailwind no
   * es ninguna de las dos cosas. `globals.css` ya avisaba de esto —había cuatro
   * `shadow-[rgba(216,183,106,0.15)]` con el latón transcrito a mano, y al cambiar
   * el latón se quedaron del color viejo— y aun así quedaba uno vivo: el cajón de
   * componer llevaba `shadow-[0_-16px_32px_rgba(0,0,0,0.5)]`, que sobre el tema
   * hielo es un borrón negro. Ahora es `--sombra-alta-arriba`, que cambia con el
   * tema como todo lo demás.
   *
   * Se permite la forma con `var()` —como la del cajón de componer, que pide
   * `--sombra-alta-arriba`—: eso **es** pedirle el relieve a la paleta.
   *
   * Y un aviso para quien edite este comentario: **Tailwind escanea los
   * comentarios**. Aquí había escrito un ejemplo de clase con `var(--` y tres
   * puntos dentro, y Tailwind lo tomó por una clase de verdad y generó
   * `--tw-shadow: var(--...)`, que no es CSS válido: la hoja entera dejó de
   * compilar y **las nueve pantallas devolvían 500** con los 2.174 tests en
   * verde. Un ejemplo de clase dentro de un comentario tiene que ser una clase
   * que se pueda generar, o no parecerse a una.
   */
  it('ninguna sombra lleva un color escrito a mano', () => {
    const aMano = /shadow-\[[^\]]*(?:rgba?\(|#[0-9a-fA-F])/;

    const pendientes = FICHEROS.filter(({ codigo }) => aMano.test(codigo)).map(({ ruta }) => ruta);

    expect(pendientes).toEqual([]);
  });

  /**
   * Y las esquinas salen de la escala, que son cuatro y tienen nombre.
   *
   * `rounded` a secas no es `rounded-sm`: es el radio por defecto de Tailwind, que
   * no sale de `ui/tokens.ts` y por tanto **no se mueve cuando se mueve la
   * escala**. Se coló en seis sitios —tres pastillas de función armónica, la
   * cifra de una unidad, un botón del acorde oído y el agarre de una nota del
   * pentagrama— y no se notó porque el valor por defecto coincidía con el nuestro.
   * El día que dejaron de coincidir habrían sido seis esquinas sueltas.
   *
   * Las de una esquina sola —`rounded-tl-none` de los bocadillos del tutor— no
   * entran: llevan sufijo, así que están en la escala.
   */
  it('ninguna esquina se sale de la escala de los tokens', () => {
    const pendientes = FICHEROS.filter(({ codigo }) => /\brounded\b(?!-)/.test(codigo)).map(
      ({ ruta }) => ruta,
    );

    expect(pendientes).toEqual([]);
  });

  /**
   * **Ningún color que no salga de la paleta**
   * ([adr/0070](../../../docs/adr/0070-la-sala-encendida.md)).
   *
   * La paleta son dieciséis colores sacados de la sala de la portada, y la regla es
   * que todo lo que sale en pantalla se pueda pintar con ellos. Lo que la rompe
   * llega por dos puertas, y las dos son una clase de Tailwind: un tono de la
   * paleta de Tailwind —`bg-black/55`, `text-white`, un `bg-red-500`— o un color
   * escrito entre corchetes. Quedaban cinco, todos de la primera: el velo detrás
   * de tres `popover` y el botón de parar la escena, que ahora piden `night` y
   * `bulb`, los dos colores de la sala que no cambian con el tema.
   *
   * Un matiz se pide con la opacidad de un token —`bg-brass/20`— o con
   * `color-mix` en `globals.css`, que es donde los mira `ui/tokens.test.ts`.
   */
  it('ningún color se sale de la paleta', () => {
    const PALETA_DE_TAILWIND =
      /\b(?:bg|text|border|fill|stroke|from|via|to|ring|outline|decoration|caret|accent|divide|shadow)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;
    const A_MANO =
      /\b(?:bg|text|border|fill|stroke|from|via|to|ring|outline|decoration|caret|accent|divide)-\[(?:#|rgba?\(|hsla?\(|oklch\()/;

    const pendientes = FICHEROS.filter(
      ({ codigo }) => PALETA_DE_TAILWIND.test(codigo) || A_MANO.test(codigo),
    ).map(({ ruta }) => ruta);

    expect(pendientes).toEqual([]);
  });

  /**
   * Los emoji no se dejan teñir, así que el estado activo se perdía justo donde se
   * mira para saber dónde estás, y cada sistema los dibuja a su manera.
   */
  it('no se usan emoji como iconos', () => {
    const pendientes = FICHEROS.filter(({ codigo }) => /[\u{1F300}-\u{1FAFF}]/u.test(codigo)).map(
      ({ ruta }) => ruta,
    );

    expect(pendientes).toEqual([]);
  });
});
