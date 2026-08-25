// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { pitchClassFromName } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { versionsError, type Version, type VersionsRequest } from './contract';
import { VersionsPanel } from './VersionsPanel';

const C = pitchClassFromName('C');

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

const SIN_PLAN: Account = { ...CON_PLAN, plan: 'medio' };

function conCuenta(node: React.ReactNode, account: Account = CON_PLAN) {
  return (
    <AccountProvider account={account} accounts>
      {node}
    </AccountProvider>
  );
}

function respondWith(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const UNA: Version = {
  title: 'Más oscura',
  why: 'Cambia la dominante por la que está a un tritono.',
  steps: [
    { degree: 'I', beats: 4, symbol: 'C', from: 'I', move: null },
    { degree: 'bII', beats: 4, symbol: 'Db', from: 'V', move: 'tritono' },
  ],
};

/** Deja una tonalidad y un camino puestos, como si se hubiera compuesto. */
function componiendo(labels: readonly string[]) {
  const { actions } = useSessionStore.getState();
  actions.pinKey({ tonic: C, mode: 'major' });
  actions.clearPath();
  for (const label of labels) {
    actions.pushChord({ symbol: label, label, root: C, notes: [C], why: 'porque sí' });
  }
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('sin el plan que las incluye', () => {
  it('enseña el candado con el plan que hace falta', () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />, SIN_PLAN));

    expect(screen.getByRole('note')).toHaveTextContent(/plan Pro/);
  });
});

describe('cuándo se puede pedir', () => {
  it('con un solo acorde no se pide, y se dice por qué', async () => {
    const fetchVersions = vi.fn();
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I']);

    expect(await screen.findByText(/al menos dos acordes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));
    expect(fetchVersions).not.toHaveBeenCalled();
  });

  it('manda los grados y la tonalidad, no cifrados ni sonido', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V', 'vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));

    expect(fetchVersions).toHaveBeenCalledTimes(1);
    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.key).toEqual({ tonic: 'C', mode: 'major' });
    expect(request.progression.map((step) => step.degree)).toEqual(['I', 'V', 'vi', 'IV']);
  });

  it('lo que no es un grado del catálogo no se manda', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V7/vi', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression.map((step) => step.degree)).toEqual(['I', 'V']);
  });
});

describe('lo que se enseña', () => {
  it('cada compás cambiado dice de dónde viene y qué movimiento se le hizo', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));

    expect(await screen.findByText('Más oscura')).toBeInTheDocument();
    expect(screen.getByText('V → bII')).toBeInTheDocument();
    expect(screen.getByText('Sustitución tritonal')).toBeInTheDocument();
    // El que no cambia enseña su grado a secas, sin flecha ni movimiento.
    expect(screen.getByText('I')).toBeInTheDocument();
  });

  it('el error del servidor se enseña tal y como lo escribe el servidor', async () => {
    const fetchVersions = vi
      .fn()
      .mockResolvedValue(
        respondWith(versionsError('quota_exhausted', 'Se te han acabado las 12 de hoy.'), 429),
      );
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Se te han acabado las 12 de hoy.');
  });

  it('sin red se dice, en vez de quedarse pensando para siempre', async () => {
    const fetchVersions = vi.fn().mockRejectedValue(new Error('sin red'));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No hemos podido contactar/);
  });
});

describe('ponerla en el camino', () => {
  it('deja la versión tocable, con los acordes resueltos por el dominio', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Ponerla en el camino/ }));

    const state = useSessionStore.getState();
    expect(state.path.map((chord) => chord.symbol)).toEqual(['C', 'Db']);
    // Las notas se resuelven, no se copian vacías: son las que dibujan el mástil.
    expect(state.path[1]!.notes.length).toBeGreaterThan(0);
    // El porqué del compás cambiado es el del movimiento que lo puso ahí.
    expect(state.path[1]!.why).toMatch(/tritono/);
    expect(state.currentDegree).toBe('bII');
  });

  it('ponerla dos veces no encadena dos copias', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Versiones de esto/ }));
    const poner = await screen.findByRole('button', { name: /Ponerla en el camino/ });
    await userEvent.click(poner);
    await userEvent.click(poner);

    expect(useSessionStore.getState().path).toHaveLength(2);
  });
});
