// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { EMPTY_PROGRESS, pitchClassFromName, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { UnitScreen } from './UnitScreen';

const empujar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: empujar }),
  usePathname: () => '/aprender/e1-grados',
}));

/**
 * Una unidad, a pantalla completa.
 *
 * Los tres «aquí no puedes entrar» son lo que se prueba, porque los tres dicen
 * cosas distintas y el que se equivoque manda a alguien a pagar por algo que ya
 * tiene o le deja mirando una pantalla que no explica nada: la unidad que **no
 * existe** —renombrada o retirada—, la que va **con plan** y la que todavía no
 * ha abierto **el temario**. Confundir las dos últimas es lo peor: cobrar por
 * algo que solo hay que desbloquear terminando la anterior.
 *
 * El avance se lee de `localStorage`, así que empieza vacío en cada test.
 */

const PRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

function pintar(unitId: string, account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <UnitScreen unitId={unitId} />
    </AccountProvider>,
  );
}

/** La primera unidad del temario: la única abierta sin haber hecho nada. */
const PRIMERA = UNIT_ORDER[0]!;

beforeEach(() => {
  localStorage.clear();
  empujar.mockReset();
});

describe('cuando no se puede entrar', () => {
  it('una unidad que ya no existe se dice, y se manda al camino', () => {
    // Pasa al renombrar o retirar algo del temario con un enlace guardado.
    pintar('una-que-no-existe');

    expect(screen.getByRole('heading', { name: /no existe/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Camino/ })).toHaveAttribute('href', '/aprender');
  });

  it('una del Profesional sin plan enseña el candado y dice que el Elemental es gratis', () => {
    const profesional = UNIT_ORDER.find((id) => id.startsWith('p'))!;

    pintar(profesional);

    expect(screen.getAllByText(/Grado Profesional/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Elemental son gratis/)).toBeInTheDocument();
  });

  it('una que el temario aun no ha abierto no ofrece pagar: se abre terminando la anterior', () => {
    // Es la distinción que importa. Enseñar aquí un candado de plan sería cobrar
    // por algo que ya se tiene.
    const segunda = UNIT_ORDER[1]!;

    pintar(segunda, PRO);

    expect(screen.getByText(/se abre al terminar la anterior/)).toBeInTheDocument();
    expect(screen.queryAllByText(/Grado Profesional/)).toHaveLength(0);
  });
});

describe('la unidad abierta', () => {
  it('se pinta con su titulo, su curso y su XP', () => {
    pintar(PRIMERA);

    expect(screen.getByText(/XP$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Camino/ })).toBeInTheDocument();
  });

  it('la tonalidad va en una barra que se abre, no ocupando media pantalla', () => {
    // Cerrada ocupa una línea y dice en qué tonalidad estás, que es lo único que
    // hay que saber mientras se contesta.
    pintar(PRIMERA);

    expect(screen.getByText(/Tonalidad:/)).toBeInTheDocument();
    expect(screen.getByText(/sin elegir/)).toBeInTheDocument();
  });
});

describe('el avance de quien mira', () => {
  it('con la anterior hecha, la siguiente se abre', () => {
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: [PRIMERA] }),
    );

    pintar(UNIT_ORDER[1]!, PRO);

    expect(screen.queryByText(/se abre al terminar la anterior/)).not.toBeInTheDocument();
  });
});

describe('contestar la unidad entera', () => {
  it('al terminarla se enseña lo ganado y la salida al camino', async () => {
    // La celebración vive en esta pantalla y no en el camino porque es el final
    // de lo que se acaba de hacer. Se llega contestando: no hay forma de
    // provocarla desde fuera, y así el test recorre lo mismo que una persona.
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    pintar(PRIMERA);

    // Se contesta lo primero que haya: acertar o fallar no cambia que la unidad
    // termine —fallar no bloquea— y lo que se prueba aquí es el final.
    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const seguir = screen.queryByRole('button', { name: /Siguiente|Terminar la unidad/ });
      if (seguir !== null) {
        await userEvent.click(seguir);
        continue;
      }
      // El `fieldset` de la pregunta, que no es el desplegable de la tonalidad.
      const pregunta = screen.queryAllByRole('group').find((grupo) => grupo.tagName === 'FIELDSET');
      const opciones = pregunta === undefined ? [] : within(pregunta).queryAllByRole('button');
      if (opciones.length === 0) {
        break;
      }
      await userEvent.click(opciones[0]!);
    }

    expect(screen.getByRole('link', { name: /Volver al camino/ })).toHaveAttribute(
      'href',
      '/aprender',
    );

    // Y «Seguir» lleva a la siguiente que se haya abierto, no de vuelta al
    // camino: encadenar unidades es la mitad de por qué esto engancha.
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(empujar).toHaveBeenCalledWith(`/aprender/${UNIT_ORDER[1]!}`);
  });
});
