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

function pantallas(): ReadonlyArray<{ nombre: string; codigo: string }> {
  return FICHEROS.filter(
    ({ ruta }) => ruta.includes('/screens/') && ruta.endsWith('Screen.tsx'),
  ).map(({ ruta, codigo }) => ({ nombre: ruta.split('/').pop()!, codigo }));
}

describe('Todas las pantallas', () => {
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
    const relleno = /className=\{`mx-auto flex flex-col gap-8 ([^`$]+)/.exec(marco)?.[1]?.trim();

    expect(relleno, 'no se ha podido leer el relleno de Screen.tsx').toBeTruthy();

    for (const { nombre, codigo } of pantallas()) {
      expect(codigo, nombre).not.toContain(relleno!);
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
