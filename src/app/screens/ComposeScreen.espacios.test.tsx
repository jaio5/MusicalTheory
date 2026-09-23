// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Arrange from '@features/arrange';
import { pitchClassFromName } from '@core/music';
import { useBancoStore } from '@state/banco';
import { useSessionStore } from '@state/session-store';
import { DEFAULT_BANCO } from '@state/workspace';

/**
 * Pasar de «Tocando» a «Escribir» en cuanto lo tocado está escrito.
 *
 * Se prueba en un fichero aparte porque hace falta **sustituir**
 * `TocarParaEscribir`: el de verdad abre el micrófono, y un micrófono en jsdom
 * no arranca, así que su botón de «verlo en la partitura» no llega a existir
 * nunca. Lo que se prueba aquí no es el micro —eso ya tiene sus pruebas en
 * `features/arrange`—, sino que la pantalla se entera y cambia de espacio.
 */
vi.mock('@features/arrange', async (original) => ({
  ...(await original<typeof Arrange>()),
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
  useBancoStore.setState({ espacio: DEFAULT_BANCO.espacio, repartos: DEFAULT_BANCO.repartos });
});

describe('De tocando a escribir', () => {
  it('cuando lo tocado ya esta escrito, la pantalla cambia de espacio', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);
    expect(useBancoStore.getState().espacio).toBe('tocando');

    await userEvent.click(screen.getByRole('button', { name: 'Verlo en la partitura' }));

    expect(useBancoStore.getState().espacio).toBe('escribir');
    // Y el reparto que se enseña es el de escribir, no el que traía tocando.
    expect(selectReparto(useBancoStore.getState())).toBe(
      useBancoStore.getState().repartos.escribir,
    );
    // Diez segundos y no los cinco de serie. Este test monta **la pantalla de
    // componer entera**, que es el componente más pesado del proyecto: suelto
    // tarda unos 700 ms, y bajo `pnpm coverage` —con la instrumentación de V8 y
    // el resto de ficheros corriendo en paralelo— pasa de los cinco. Estaba al
    // borde, y crecer el temario en tres unidades bastó para tirarlo: fallaba
    // solo en cobertura y se llevaba por delante la de todo su fichero, que es
    // un 4 % del total y parece otra cosa. El número no afloja ninguna
    // comprobación; solo deja de medir la máquina.
  }, 10_000);
});
