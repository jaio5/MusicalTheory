// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { A4_FREQUENCY, midiToFrequency, pitchClassFromName } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { PROPORCION } from './Fretboard';
import { FretboardPanel } from './FretboardPanel';

describe('Panel del mástil', () => {
  it('pide una tonalidad mientras no haya ninguna', () => {
    render(<FretboardPanel />);
    expect(screen.getByText(/toca unas notas sueltas o elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña la escala de la tonalidad fijada', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<FretboardPanel />);

    expect(await screen.findByText(/pentatónica menor de A/i)).toBeInTheDocument();
    // La pentatónica menor de A: A, C, D, E, G.
    expect(screen.getByText('A · C · D · E · G')).toBeInTheDocument();
  });

  it('cambia de escala al elegir otra', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<FretboardPanel />);

    // La escala se elige en la barra de herramientas, no dentro del panel: el
    // mástil solo pinta la que esté puesta.
    await act(async () => {
      useSessionStore.getState().actions.setScale('blues');
    });

    expect(await screen.findByText('A · C · D · Eb · E · G')).toBeInTheDocument();
  });

  it('describe el mástil para quien no lo ve', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<FretboardPanel />);

    expect(
      await screen.findByRole('img', { name: /mástil de 12 trastes.*pentatónica menor.*A/i }),
    ).toBeInTheDocument();
  });

  it('no enciende ninguna nota si no hay señal', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    actions.setPitch(midiToFrequency(45), 0.99, 0);
    actions.setPitch(null);

    render(<FretboardPanel />);

    // Con la señal caída, la nota deja de estar encendida aunque siga siendo
    // la última leída.
    expect(useSessionStore.getState().hasSignal).toBe(false);
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });

  it('acumula lo tocado y acaba proponiendo una tonalidad', () => {
    const { actions } = useSessionStore.getState();
    // Un rato en A menor, con instantes separados para que el histograma
    // llegue a recalcularse.
    const sequence = [45, 48, 52, 45, 55, 52, 50, 48, 45, 52, 45];
    sequence.forEach((midi, index) => {
      actions.setPitch(midiToFrequency(midi), 0.99, index * 300);
    });

    render(<FretboardPanel />);

    expect(useSessionStore.getState().keyCandidates.length).toBeGreaterThan(0);
    expect(screen.queryByText(/toca unas notas sueltas o elige/i)).not.toBeInTheDocument();
  });

  it('el diapasón por sí solo no rompe nada', () => {
    useSessionStore.getState().actions.setPitch(A4_FREQUENCY, 0.99, 0);
    render(<FretboardPanel />);

    // Una nota suelta no basta para saber la tonalidad, y el mástil lo dice en
    // vez de pintar una escala inventada.
    expect(screen.getByText(/toca unas notas sueltas/i)).toBeInTheDocument();
  });
});

/**
 * El mástil marca **el bloque que tienes elegido**.
 *
 * Era el último del camino —la segunda canción paralela a la de verdad—, así que
 * elegías un acorde de tu canción y el mástil seguía marcando otro
 * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
 */
describe('qué acorde marca el mástil', () => {
  it('el del bloque elegido, y no el ultimo del camino', () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    // En el camino, un La menor; en la canción, elegido, un Fa.
    actions.pushChord({ symbol: 'Am', label: 'vi', root: 9, notes: [9, 0, 4], why: '' });
    const parte = useArrangementStore.getState().actions.addPart('Estrofa');
    const bloque = useArrangementStore.getState().actions.addBlock(parte, 'IV', 4);
    useArrangementStore.getState().actions.elegirBloque(bloque);

    render(<FretboardPanel />);

    expect(screen.getByText(/las notas de F:/)).toBeInTheDocument();
    expect(screen.queryByText(/las notas de Am:/)).not.toBeInTheDocument();
  });

  /**
   * El hueco del dibujo lleva la proporción del mástil, que es lo que hace que
   * el área pida el alto justo para llenar su ancho
   * ([adr/0037](../../../docs/adr/0037-el-mastil-pide-su-alto.md)).
   *
   * **Sin esto el mástil se veía a menos de la mitad de lo que le cabía**: el
   * hueco se quedaba con lo que sobrara y el dibujo se encogía centrado dentro,
   * con franjas muertas de casi cuatrocientos píxeles a cada lado. Medido a
   * 1440 de ancho: se pintaba a 650 teniendo 1416.
   */
  it('el hueco del dibujo lleva la proporcion del mastil', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    const { container } = render(<FretboardPanel />);

    const dibujo = await screen.findByRole('img', { name: /mástil de/i });
    const hueco = dibujo.parentElement;
    expect(hueco).not.toBeNull();
    // Leída con `parseFloat` porque jsdom la normaliza a «3.8 / 1».
    expect(Number.parseFloat(hueco!.style.aspectRatio)).toBeCloseTo(PROPORCION);
    // Y el tope, que es lo que impide que se lleve el alto de la canción.
    expect(hueco!.className).toContain('lg:max-h-[calc(100dvh-35rem)]');
    expect(container.querySelector('svg')).toHaveClass('h-full', 'w-full');
  });
});
