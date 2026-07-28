import { afterEach, beforeEach } from 'vitest';

import { useSessionStore } from './src/state/session-store';

/**
 * Arranque común de los tests.
 *
 * El desmontaje entre tests se registra aquí y no dentro de cada `describe`:
 * ponerlo dentro deja sin limpieza a los bloques que vengan después en el mismo
 * fichero, y el síntoma es desconcertante —«hay dos botones iguales»— porque el
 * panel del test anterior sigue en el DOM.
 *
 * Solo se hace en los tests con DOM: los del dominio corren en Node y ahí no
 * hay nada que desmontar.
 */
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);

  // jsdom no implementa el scroll: no maqueta nada, así que no tiene qué mover.
  // Sin esto, cualquier carrusel revienta el test con un error que no habla de
  // scroll sino de «no es una función».
  Element.prototype.scrollTo = () => {};
}

/**
 * Cada test arranca con la sesión limpia. Por el mismo motivo que la limpieza
 * del DOM: dejarlo en manos de cada `describe` significa que antes o después
 * uno se queda sin ello y hereda el estado del test anterior.
 */
beforeEach(() => {
  useSessionStore.getState().actions.reset();
});
