/**
 * Arranca un `<video>` sin que su fallo tumbe lo que venga detrás.
 *
 * `play()` devuelve una promesa en los navegadores actuales, pero no en los
 * antiguos ni en jsdom, así que encadenarle un `.catch` a ciegas revienta.
 * Y cuando sí la devuelve, puede rechazarse por la política de
 * autoreproducción, que aquí no es un error: el fotograma se compone igual.
 */
export async function playQuietly(element: HTMLMediaElement): Promise<void> {
  try {
    await element.play();
  } catch {
    // Sin vídeo en marcha el canvas pinta negro, que es preferible a no grabar.
  }
}
