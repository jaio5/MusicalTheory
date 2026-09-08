// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { pitchClassFromName } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { TeacherScreen } from './TeacherScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/profesor',
}));

/**
 * El profesor en su propia pantalla.
 *
 * Lo que aquí importa es que **la tonalidad está a la vista**: es lo que cambia
 * la respuesta, porque el profesor contesta con los acordes de la que tengas
 * puesta y no con un ejemplo en Do mayor. Sin tonalidad hay que decirlo y decir
 * cómo se pone, o la respuesta sale genérica sin que nadie entienda por qué.
 */

const PRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

function pintar(account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <TeacherScreen />
    </AccountProvider>,
  );
}

describe('El profesor', () => {
  it('sin tonalidad lo dice, y dice cómo ponerla', () => {
    useSessionStore.getState().actions.reset();

    pintar();

    expect(screen.getByText(/ninguna tonalidad todavía/)).toBeInTheDocument();
    expect(screen.getByText(/Elígela en la rueda/)).toBeInTheDocument();
    // Y **notas sueltas**, no «unos compases»: la tonalidad se deduce del
    // histograma de alturas, y ese lo llena el motor de tono, que es monofónico.
    // Rasgueando acordes no entra ni una nota y no se detecta nada.
    expect(screen.getByText(/notas sueltas/)).toBeInTheDocument();
  });

  it('con tonalidad, dice en cuál está explicando', () => {
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    pintar();

    expect(screen.getAllByText(/menor/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ninguna tonalidad todavía/)).not.toBeInTheDocument();
    expect(screen.getByText(/Cámbiala y la misma pregunta/)).toBeInTheDocument();
  });

  it('dice el cupo del plan y que a la IA solo viajan simbolos', () => {
    // Es la regla 4 de la arquitectura dicha donde se puede leer: el audio no
    // sale del dispositivo.
    pintar();

    expect(screen.getByText(/Nada de audio/)).toBeInTheDocument();
  });

  it('a quien no tiene Pro le enseña qué le falta', () => {
    pintar();

    expect(screen.getByText(/Con el plan Pro/)).toBeInTheDocument();
    expect(screen.getByText(/qué unidades llevas hechas/)).toBeInTheDocument();
  });

  it('a quien ya lo tiene, no le enseña un candado abierto', () => {
    pintar(PRO);

    expect(screen.queryByText(/Con el plan Pro/)).not.toBeInTheDocument();
  });
});
