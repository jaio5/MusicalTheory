// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { PathPanel } from './PathPanel';

const C = pitchClassFromName('C');

describe('El camino', () => {
  it('pide una tonalidad para empezar', () => {
    render(<PathPanel />);
    expect(screen.getByText(/elige una tonalidad arriba y empezamos/i)).toBeInTheDocument();
  });

  it('propone por dónde empezar', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<PathPanel />);

    expect(await screen.findByText(/por dónde empezar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C, I' })).toBeInTheDocument();
  });

  it('al elegir un acorde enseña cómo se hace', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<PathPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'C, I' }));

    // Do mayor al aire es x32010.
    expect(await screen.findByRole('img', { name: /x32010/ })).toBeInTheDocument();
    expect(screen.getByText(/1\.ª posición/)).toBeInTheDocument();
  });

  it('y a dónde ir desde él', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<PathPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'C, I' }));

    expect(await screen.findByText(/y desde aquí/i)).toBeInTheDocument();
    expect(screen.getAllByText(/cae por quintas/i).length).toBeGreaterThan(0);
  });

  it('encadena acordes y deja volver atrás', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<PathPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'C, I' }));
    await userEvent.click(await screen.findByRole('button', { name: 'F, IV' }));

    const path = screen.getByRole('list', { name: 'Progresión' });
    expect(within(path).getByText('C')).toBeInTheDocument();
    expect(within(path).getByText('F')).toBeInTheDocument();

    // Volver al primero recorta el camino.
    await userEvent.click(within(path).getByText('C'));
    expect(
      within(screen.getByRole('list', { name: 'Progresión' })).queryByText('F'),
    ).not.toBeInTheDocument();
  });

  it('permite empezar de nuevo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    render(<PathPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'C, I' }));
    await userEvent.click(await screen.findByRole('button', { name: /empezar de nuevo/i }));

    expect(await screen.findByText(/por dónde empezar/i)).toBeInTheDocument();
  });
});
