// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { pitchClassFromName, SCALE_IDS } from '@core/music';
import { useClaqueta } from '@state/claqueta';
import { useSessionStore } from '@state/session-store';

import { anuncioDeEscala, EscalaDelMastil, escalaVecina } from './EscalaDelMastil';
import { FretboardPanel, RotulosDelMastil } from './FretboardPanel';

/** La cabecera y el dibujo, como los monta el área de componer. */
function ElMastilEntero() {
  return (
    <>
      <RotulosDelMastil />
      <FretboardPanel />
    </>
  );
}

function enLa() {
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
}

function elSelector() {
  return within(screen.getByRole('group', { name: 'Escala' }));
}

afterEach(() => {
  act(() => useClaqueta.getState().acciones.marcarToma(false));
});

describe('las escalas vecinas', () => {
  it('pasa a la siguiente y a la anterior en el orden de la lista', () => {
    expect(escalaVecina('minorPentatonic', 1)).toBe('blues');
    expect(escalaVecina('blues', -1)).toBe('minorPentatonic');
  });

  it('da la vuelta por los dos extremos, para poder recorrerlas todas sin parar', () => {
    expect(escalaVecina(SCALE_IDS.at(-1)!, 1)).toBe(SCALE_IDS[0]);
    expect(escalaVecina(SCALE_IDS[0]!, -1)).toBe(SCALE_IDS.at(-1));
  });

  it('dice el nombre y cuántas notas marca', () => {
    expect(anuncioDeEscala('minorPentatonic')).toBe('Pentatónica menor: 5 notas');
    expect(anuncioDeEscala('blues')).toBe('Blues: 6 notas');
    expect(anuncioDeEscala('dorian')).toBe('Dórico: 7 notas');
  });
});

/**
 * **La escala del mástil es la de siempre.** Cambiarla aquí la cambia en el
 * almacén de la sesión —la que leen la tonalidad, el punteo y el profesor— y el
 * dibujo se repinta sin cerrar el área.
 */
describe('cambiar la escala desde el mástil', () => {
  it('cambia la escala común y el mástil repinta sus notas', async () => {
    enLa();
    const user = userEvent.setup();
    render(<ElMastilEntero />);

    expect(screen.getByRole('img', { name: /pentatónica menor de A/i })).toBeInTheDocument();
    expect(screen.getByText('A · C · D · E · G')).toBeInTheDocument();

    await user.selectOptions(elSelector().getByRole('combobox', { name: 'Escala' }), 'blues');

    expect(useSessionStore.getState().scaleId).toBe('blues');
    expect(screen.getByRole('img', { name: /blues de A/i })).toBeInTheDocument();
    expect(screen.getByText('A · C · D · Eb · E · G')).toBeInTheDocument();
  });

  it('las flechas pasan a la siguiente y a la anterior sin abrir nada', async () => {
    enLa();
    const user = userEvent.setup();
    render(<ElMastilEntero />);

    await user.click(elSelector().getByRole('button', { name: 'Escala siguiente' }));
    expect(useSessionStore.getState().scaleId).toBe('blues');
    await user.click(elSelector().getByRole('button', { name: 'Escala siguiente' }));
    expect(useSessionStore.getState().scaleId).toBe('dorian');
    expect(screen.getByRole('img', { name: /dórico de A/i })).toBeInTheDocument();

    await user.click(elSelector().getByRole('button', { name: 'Escala anterior' }));
    expect(useSessionStore.getState().scaleId).toBe('blues');
    expect(elSelector().getByRole('combobox', { name: 'Escala' })).toHaveValue('blues');
  });

  it('cada flecha dice a cuál lleva, para quien la mira antes de pulsar', () => {
    enLa();
    render(<EscalaDelMastil />);

    expect(elSelector().getByRole('button', { name: 'Escala siguiente' })).toHaveAttribute(
      'title',
      'Siguiente: Blues',
    );
    expect(elSelector().getByRole('button', { name: 'Escala anterior' })).toHaveAttribute(
      'title',
      'Anterior: Pentatónica mayor',
    );
  });

  it('enseña la que se elija en otro sitio, porque no hay otra', () => {
    enLa();
    render(<EscalaDelMastil />);

    act(() => useSessionStore.getState().actions.setScale('phrygian'));

    expect(elSelector().getByRole('combobox', { name: 'Escala' })).toHaveValue('phrygian');
  });

  it('ofrece las nueve escalas con su nombre en español', () => {
    render(<EscalaDelMastil />);

    const opciones = within(elSelector().getByRole('combobox', { name: 'Escala' })).getAllByRole(
      'option',
    );
    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      'Mayor',
      'Menor natural',
      'Pentatónica mayor',
      'Pentatónica menor',
      'Blues',
      'Dórico',
      'Mixolidio',
      'Frigio',
      'Menor armónica',
    ]);
  });
});

describe('la accesibilidad del selector', () => {
  it('se recorre con el tabulador y se cambia con el teclado', async () => {
    enLa();
    const user = userEvent.setup();
    render(<EscalaDelMastil />);

    await user.tab();
    expect(elSelector().getByRole('button', { name: 'Escala anterior' })).toHaveFocus();
    await user.tab();
    expect(elSelector().getByRole('combobox', { name: 'Escala' })).toHaveFocus();
    await user.tab();
    const siguiente = elSelector().getByRole('button', { name: 'Escala siguiente' });
    expect(siguiente).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(useSessionStore.getState().scaleId).toBe('blues');
    await user.keyboard(' ');
    expect(useSessionStore.getState().scaleId).toBe('dorian');
    // El foco se queda en la flecha: se prueban varias seguidas sin volver a ella.
    expect(siguiente).toHaveFocus();
  });

  it('las flechas miden 44 de alto, y de ancho mientras quepan', () => {
    render(<EscalaDelMastil />);

    for (const nombre of ['Escala anterior', 'Escala siguiente']) {
      const flecha = elSelector().getByRole('button', { name: nombre });
      expect(flecha).toHaveClass('min-h-tap', 'w-9', 'min-[23rem]:w-11');
    }
  });

  /**
   * La región viva está **antes** que el mensaje: una que nace con el texto
   * dentro no la lee todo lector de pantalla.
   */
  it('anuncia el cambio una vez, en una región que ya estaba', async () => {
    enLa();
    const user = userEvent.setup();
    const { container } = render(<EscalaDelMastil />);

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeEmptyDOMElement();

    await user.click(elSelector().getByRole('button', { name: 'Escala anterior' }));
    expect(region).toHaveTextContent(/^Pentatónica mayor: 5 notas$/);

    await user.selectOptions(elSelector().getByRole('combobox', { name: 'Escala' }), 'major');
    expect(region).toHaveTextContent(/^Mayor: 7 notas$/);
  });

  /**
   * **Durante una toma no habla** ([adr/0072](../../../docs/adr/0072-la-claqueta-suena-toda-la-toma.md)):
   * suena el clic y se está tocando, y un lector de pantalla encima tapa el
   * pulso. La escala sí cambia: lo que se calla es el aviso.
   */
  it('durante una toma cambia la escala sin decir nada', async () => {
    enLa();
    const user = userEvent.setup();
    const { container } = render(<EscalaDelMastil />);
    const region = container.querySelector('[aria-live="polite"]');

    await user.click(elSelector().getByRole('button', { name: 'Escala siguiente' }));
    expect(region).toHaveTextContent('Blues: 6 notas');

    act(() => useClaqueta.getState().acciones.marcarToma(true));
    await user.click(elSelector().getByRole('button', { name: 'Escala siguiente' }));

    expect(useSessionStore.getState().scaleId).toBe('dorian');
    // Y no se queda el aviso de antes: al acabar la toma no hay nada pendiente.
    expect(region).toBeEmptyDOMElement();
  });
});
