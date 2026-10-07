import localFont from 'next/font/local';

/**
 * Las tres letras de la aplicación, **servidas desde aquí** y no desde un CDN
 * ([adr/0070](../../docs/adr/0070-la-sala-encendida.md)).
 *
 * Antes eran las del sistema —Georgia, `system-ui` y una JetBrains Mono que nadie
 * descargaba—, y eso quería decir que **la letra dependía del equipo**: en un
 * Linux sin Georgia los títulos salían en DejaVu Serif y el cuerpo en DejaVu Sans,
 * que es lo que se veía en todas las capturas de este repositorio. Una identidad
 * que cambia según el ordenador no es una identidad.
 *
 * - **Archivo ancha** para los títulos. Instanciada a un ancho fijo de 116 % y
 *   pesos de 500 a 800: es la rotulación de un flight case o del frontal de un
 *   ampli, la letra del local de ensayo, y a ese ancho se lee de lejos. Fijar el
 *   ancho la deja en 27 kB en vez de 90.
 * - **Atkinson Hyperlegible Next** para todo lo demás. Está dibujada para leerse
 *   con poca vista —la «I», la «l» y el «1» no se confunden, ni la «b» con la «d»—,
 *   y esta aplicación se lee **a un metro y con las dos manos ocupadas**.
 * - **Atkinson Hyperlegible Mono** para lo que se alinea en columna
 *   ([adr/0024](../../docs/adr/0024-la-interfaz-se-lee-primero.md)): la misma
 *   familia, así que un cifrado dentro de una frase no desentona.
 *
 * Las dos primeras se precargan porque salen en cada pantalla; la monoespaciada
 * no, que solo la usan algunas y llega a tiempo con `swap`.
 *
 * Cada una deja su variable en el `<html>`, y `globals.css` las pide por su
 * nombre en `--font-display`, `--font-sans` y `--font-mono`. Así Tailwind no se
 * entera de cómo se cargan.
 */
export const titulos = localFont({
  src: './_fuentes/archivo-ancha.woff2',
  variable: '--fuente-titulos',
  weight: '500 800',
  display: 'swap',
});

export const cuerpo = localFont({
  src: './_fuentes/atkinson-next.woff2',
  variable: '--fuente-cuerpo',
  weight: '200 800',
  display: 'swap',
});

export const cifras = localFont({
  src: './_fuentes/atkinson-mono.woff2',
  variable: '--fuente-cifras',
  weight: '200 800',
  display: 'swap',
  preload: false,
  // La reserva de una monoespaciada tiene que ser otra monoespaciada: con Arial,
  // que es la de serie, las columnas de cents bailarían hasta que llegara.
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
});

/** Las tres variables juntas, para el `<html>`. */
export const CLASES_DE_FUENTES = `${titulos.variable} ${cuerpo.variable} ${cifras.variable}`;
