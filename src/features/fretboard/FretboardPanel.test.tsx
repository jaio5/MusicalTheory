// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { A4_FREQUENCY, midiToFrequency, pitchClassFromName } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { PROPORCION } from './Fretboard';
import { FretboardPanel, RotulosDelMastil } from './FretboardPanel';

/**
 * El panel con sus rótulos, que en la aplicación van en la cabecera del área y
 * aquí hay que montar a mano ([adr/0037](../../../docs/adr/0037-el-mastil-pide-su-alto.md)).
 */
function ElMastilEntero() {
  return (
    <>
      <RotulosDelMastil />
      <FretboardPanel />
    </>
  );
}

describe('Panel del mástil', () => {
  it('pide una tonalidad mientras no haya ninguna', () => {
    render(<FretboardPanel />);
    expect(screen.getByText(/toca unas notas sueltas o elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña la escala de la tonalidad fijada', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<ElMastilEntero />);

    expect(await screen.findByText(/pentatónica menor de A/i)).toBeInTheDocument();
    // La pentatónica menor de A: A, C, D, E, G.
    expect(screen.getByText('A · C · D · E · G')).toBeInTheDocument();
  });

  it('cambia de escala al elegir otra', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<ElMastilEntero />);

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

    render(<ElMastilEntero />);

    expect(screen.getByText(/las notas de F:/)).toBeInTheDocument();
    expect(screen.queryByText(/las notas de Am:/)).not.toBeInTheDocument();
  });

  /**
   * El hueco pone **el máximo**, y dentro de él manda la proporción del dibujo
   * ([adr/0039](../../../docs/adr/0039-el-mastil-se-estira-a-lo-ancho.md),
   * [adr/0046](../../../docs/adr/0046-el-mastil-solo-ocupa-lo-que-dibuja.md)).
   */
  it('el hueco pone el maximo, y el dibujo su proporcion', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    const { container } = render(<FretboardPanel />);

    const dibujo = await screen.findByRole('img', { name: /mástil de/i });
    // El dibujo va dentro de la caja que se mide, y esa dentro del hueco.
    const hueco = dibujo.parentElement!.parentElement;
    expect(hueco).not.toBeNull();
    // Leída con `parseFloat` porque jsdom la normaliza a «3.8 / 1».
    // En estrecho el alto lo pone la proporción natural, y va en una clase
    // porque Tailwind lee el fichero. **Si dejan de coincidir, esto avisa.**
    expect(hueco!.className).toContain('aspect-[712/198]');
    expect(PROPORCION).toBeCloseTo(712 / 198);
    // **La proporción manda en los dos, y el hueco solo pone el techo.** Cuando
    // el alto del hueco era fijo, en una ventana alta la caja se quedaba más
    // alta de lo que el dibujo puede usar y sobraban 149 px de bandas vacías a
    // 1440×900 y 206 a 1920×1080 —arriba y abajo del mástil— mientras el arreglo
    // estaba en su suelo. Con `max-h` el dibujo mide **exactamente lo mismo** y
    // esos píxeles vuelven a la canción.
    expect(hueco!.className).not.toContain('lg:aspect-auto');
    expect(hueco!.className).toContain('lg:max-h-[calc(100dvh-26rem)]');
    expect(container.querySelector('svg')).toHaveClass('h-full', 'w-full');
  });

  /** Sin tonalidad no hay escala, así que la cabecera no dice nada. */
  it('los rotulos callan mientras no haya tonalidad', () => {
    const { container } = render(<RotulosDelMastil />);
    expect(container).toBeEmptyDOMElement();
  });
});
