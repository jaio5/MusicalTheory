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
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

function pintar(account: Account = ANONYMOUS, accounts = true) {
  return render(
    <AccountProvider account={account} accounts={accounts}>
      <TeacherScreen />
    </AccountProvider>,
  );
}

describe('El profesor', () => {
  it('sin tonalidad lo dice, y dice cómo ponerla', () => {
    useSessionStore.getState().actions.reset();

    pintar();

    expect(screen.getByText(/ninguna tonalidad todavía/)).toBeInTheDocument();
    expect(screen.getByText(/Elige una en la rueda/)).toBeInTheDocument();
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

  // Mandaba la rueda y la pregunta caía bajo el pliegue a 390 px: con tonalidad
  // puesta, la pregunta va primero y la tonalidad detrás.
  it('con tonalidad, la pregunta va antes que la tonalidad', () => {
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    pintar();

    const pregunta = screen.getByRole('region', { name: 'La pregunta' });
    const tonalidad = screen.getByRole('region', { name: 'Tonalidad' });
    expect(
      pregunta.compareDocumentPosition(tonalidad) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // Sin tonalidad el formulario ya ofrece cuatro ahí mismo: la rueda no pasa delante.
  it('sin tonalidad, la pregunta también va primero', () => {
    useSessionStore.getState().actions.reset();

    pintar();

    const pregunta = screen.getByRole('region', { name: 'La pregunta' });
    const tonalidad = screen.getByRole('region', { name: 'Tonalidad' });
    expect(
      pregunta.compareDocumentPosition(tonalidad) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('dice el cupo del plan y que a la IA solo viajan simbolos', () => {
    // Es la regla 4 de la arquitectura dicha donde se puede leer: el audio no
    // sale del dispositivo.
    pintar();

    expect(screen.getByText(/Nada de audio/)).toBeInTheDocument();
  });

  it('a quien no tiene Medio le enseña qué le falta', () => {
    pintar();

    expect(screen.getByText(/Con el plan Medio/)).toBeInTheDocument();
    expect(screen.getByText(/qué unidades llevas hechas/)).toBeInTheDocument();
  });

  it('a quien ya lo tiene, no le enseña un candado abierto', () => {
    pintar(PRO);

    expect(screen.queryByText(/Con el plan Pro/)).not.toBeInTheDocument();
  });

  /**
   * **Sin cuentas no promete un cupo ni manda a entrar.** Decía «quince preguntas
   * al mes» y llevaba a `/cuenta`, donde solo se leía que aquí no hay cuentas.
   */
  it('en una copia sin cuentas lo dice, y no ofrece ni cupo ni plan ni entrar', () => {
    useSessionStore.getState().actions.reset();

    pintar(ANONYMOUS, false);

    expect(screen.getByText(/no tiene cuentas configuradas/)).toBeInTheDocument();
    expect(screen.queryByText(/preguntas al\s+profesor al mes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Con el plan Pro/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Entrar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Seguir aprendiendo' })).toHaveAttribute(
      'href',
      '/aprender',
    );
  });
});

/**
 * El aviso del AI Act (art. 50.1): **donde se pregunta**, antes de escribir, y no
 * solo en la política de privacidad.
 */
describe('se dice que es una IA', () => {
  it('encima de la pregunta, con lo que se le manda a un clic', () => {
    useSessionStore.getState().actions.reset();
    pintar(PRO);

    expect(screen.getByText(/Hablas con una IA, no con una persona/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Qué se le manda' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
  });

  it('sin cuentas no hay profesor, y no hay aviso de nada', () => {
    pintar(ANONYMOUS, false);
    expect(screen.queryByText(/Hablas con una IA/)).not.toBeInTheDocument();
  });
});
