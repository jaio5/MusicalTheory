// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Tocar from '@features/arrange/TocarParaEscribir';
import { pitchClassFromName } from '@core/music';
import { useBancoStore } from '@state/banco';
import { useSessionStore } from '@state/session-store';
import { DEFAULT_BANCO, loadPreferences, savePreferences } from '@state/workspace';

// Tocando llega en diferido (adr/0058): con la suite entera y la cobertura, su trozo
// tarda más que el segundo que `findBy` espera de serie, y el test caía sin fallo.
const LO_DIFERIDO = { timeout: 5_000 };

/**
 * Pasar de «Tocando» a «Escribir» en cuanto lo tocado está escrito.
 *
 * Se prueba en un fichero aparte porque hace falta **sustituir**
 * `TocarParaEscribir`: el de verdad abre el micrófono, y un micrófono en jsdom
 * no arranca, así que su botón de «verlo en la partitura» no llega a existir
 * nunca. Lo que se prueba aquí no es el micro —eso ya tiene sus pruebas en
 * `features/arrange`—, sino que la pantalla se entera y cambia de espacio.
 */
// El módulo y no el índice: la pantalla lo carga en diferido de ahí, para no
// traérselo en el paquete de entrada (adr/0058).
// **El lienzo de verdad solo lo carga su propio test.** Vitest reutiliza cada
// proceso para varios ficheros, y si en uno caían dos que cargaban
// `ArrangeCanvas.tsx`, V8 tenía dos copias del mismo módulo y al juntar la
// cobertura se quedaba con las cuentas de una: las ramas bajaban al 90 % una
// pasada de cada dos, con todos los tests en verde. Aquí basta con que llegue.
vi.mock('@features/arrange/ArrangeCanvas', () => ({ ArrangeCanvas: () => null }));

vi.mock('@features/arrange/TocarParaEscribir', async (original) => ({
  ...(await original<typeof Tocar>()),
  TocarParaEscribir: ({ onEscrito }: { readonly onEscrito?: () => void }) => (
    <button type="button" onClick={onEscrito}>
      Verlo en la partitura
    </button>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/componer',
}));

const { ComposeScreen } = await import('./ComposeScreen');
const { selectReparto } = await import('@state/banco');

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  // Desde tocando, guardado: se entra por escribir, y aquí se viene a tocar.
  const banco = { espacio: 'tocando' as const, repartos: DEFAULT_BANCO.repartos };
  savePreferences({ ...loadPreferences(), banco });
  useBancoStore.setState(banco);
});

describe('De tocando a escribir', () => {
  it('cuando lo tocado ya esta escrito, la pantalla cambia de espacio', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);
    expect(useBancoStore.getState().espacio).toBe('tocando');

    // Tocando llega en diferido: se entra por escribir (adr/0058, adr/0109).
    await userEvent.click(
      await screen.findByRole('button', { name: 'Verlo en la partitura' }, LO_DIFERIDO),
    );

    expect(useBancoStore.getState().espacio).toBe('escribir');
    // Y el reparto que se enseña es el de escribir, no el que traía tocando.
    expect(selectReparto(useBancoStore.getState())).toBe(
      useBancoStore.getState().repartos.escribir,
    );
  });
});
