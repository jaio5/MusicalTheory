// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClaqueta } from '@state/claqueta';
import { useMicrofono } from '@state/microfono';
import { useSessionStore } from '@state/session-store';

import { ElegirMicro } from './ElegirMicro';

/**
 * El mando de elegir micrófono de la barra: un botón que abre la lista, con el
 * elegido marcado, «El del sistema» y lo que haga falta decir —que falta el
 * permiso, que el elegido no está, que el cambio espera a la toma—.
 */

const LISTA = [
  { deviceId: 'default', label: 'Por defecto - Portátil', kind: 'audioinput' },
  { deviceId: 'portatil', label: 'Portátil', kind: 'audioinput' },
  { deviceId: 'tarjeta', label: 'Scarlett', kind: 'audioinput' },
];

let lista: typeof LISTA = LISTA;
const enumerar = vi.fn(async () => lista);

beforeEach(() => {
  lista = LISTA;
  enumerar.mockClear();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { enumerateDevices: enumerar } },
  });
  localStorage.clear();
  useMicrofono.setState({
    elegido: null,
    nombreElegido: '',
    cargado: false,
    entradas: [],
    delSistema: null,
    conNombres: false,
    cayo: false,
    pendiente: false,
    anuncio: '',
  });
  useClaqueta.getState().acciones.marcarToma(false);
  useSessionStore.getState().actions.reset();
});

const mando = () => screen.getByRole('button', { name: /^Micrófono:/ });
const panel = () => document.querySelector<HTMLElement>('[popover]')!;

describe('el mando', () => {
  it('se llama por lo que es y por cuál, y abre su lista', async () => {
    render(<ElegirMicro />);

    await waitFor(() => expect(useMicrofono.getState().conNombres).toBe(true));
    expect(mando()).toHaveAccessibleName('Micrófono: El del sistema');
    expect(mando()).toHaveAttribute('popovertarget', panel().id);
    expect(panel()).toHaveAttribute('popover', 'auto');
    expect(mando()).toHaveClass('size-tap');
  });

  it('trae lo elegido de otra vez', async () => {
    localStorage.setItem(
      'caos-ordenado:workspace',
      JSON.stringify({ microfono: { id: 'tarjeta', nombre: 'Scarlett' } }),
    );
    render(<ElegirMicro />);

    await waitFor(() => expect(mando()).toHaveAccessibleName('Micrófono: Scarlett'));
  });

  it('el elegido va marcado, y el del sistema dice cuál es', async () => {
    useMicrofono.setState({ elegido: 'tarjeta', nombreElegido: 'Scarlett', cargado: true });
    render(<ElegirMicro />);
    const dentro = within(panel());

    expect(await dentro.findByRole('button', { name: 'Scarlett', hidden: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(dentro.getByRole('button', { name: /El del sistema/, hidden: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(dentro.getByText('Por defecto - Portátil')).toBeInTheDocument();
  });

  it('elegir cierra la lista y cambia el micro', async () => {
    render(<ElegirMicro />);
    const cerrar = vi.fn();
    Object.assign(panel(), { hidePopover: cerrar });

    await userEvent.click(
      await within(panel()).findByRole('button', { name: 'Portátil', hidden: true }),
    );

    expect(cerrar).toHaveBeenCalled();
    expect(useMicrofono.getState().elegido).toBe('portatil');
    expect(mando()).toHaveAccessibleName('Micrófono: Portátil');
  });

  // En jsdom no hay `popover`: elegir funciona igual.
  it('sin la API del popover, elige igual', async () => {
    useMicrofono.setState({ elegido: 'tarjeta', cargado: true });
    render(<ElegirMicro />);

    await userEvent.click(
      within(panel()).getByRole('button', { name: /El del sistema/, hidden: true }),
    );

    expect(useMicrofono.getState().elegido).toBeNull();
  });

  it('al abrirse vuelve a preguntar la lista, y al cerrarse no', async () => {
    render(<ElegirMicro />);
    await waitFor(() => expect(enumerar).toHaveBeenCalledTimes(1));

    fireEvent(panel(), Object.assign(new Event('toggle'), { newState: 'open' }));
    fireEvent(panel(), Object.assign(new Event('toggle'), { newState: 'closed' }));

    await waitFor(() => expect(enumerar).toHaveBeenCalledTimes(2));
  });
});

describe('lo que dice', () => {
  // Sin permiso el navegador deja los nombres en blanco.
  it('sin permiso, que los nombres salen al darlo', async () => {
    lista = [{ deviceId: '', label: '', kind: 'audioinput' }];
    render(<ElegirMicro />);

    expect(await within(panel()).findByText(/salen al darle permiso/)).toBeInTheDocument();
    expect(within(panel()).getAllByRole('button', { hidden: true })).toHaveLength(1);
  });

  it('el elegido que no está: en el nombre, en la lista y con una marca', async () => {
    lista = LISTA.filter((aparato) => aparato.deviceId !== 'tarjeta');
    useMicrofono.setState({ elegido: 'tarjeta', nombreElegido: 'Scarlett', cargado: true });
    render(<ElegirMicro />);

    await waitFor(() => expect(mando()).toHaveAccessibleName('Micrófono: Scarlett, no conectado'));
    const fila = within(panel()).getByRole('button', { name: /Scarlett/, hidden: true });
    expect(fila).toHaveAttribute('aria-pressed', 'true');
    expect(fila).toHaveTextContent('No está conectado');

    // Volver a pulsarlo lo vuelve a intentar.
    await userEvent.click(fila);
    expect(useMicrofono.getState().elegido).toBe('tarjeta');
  });

  it('si cayó al del sistema, lo dice y lleva la marca', async () => {
    render(<ElegirMicro />);
    act(() => useMicrofono.getState().acciones.marcarCaida(true));

    expect(
      within(panel()).getByText(/no está conectado: escucho por el del sistema/),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-aviso-del-micro]')).toHaveClass('bg-oxblood-bright');
    expect(mando()).toHaveAttribute('title', 'El micrófono elegido no está conectado');
  });

  it('si el cambio espera a la toma, lo dice', () => {
    render(<ElegirMicro />);
    act(() => useMicrofono.getState().acciones.marcarPendiente(true));

    expect(within(panel()).getByText(/al acabar la toma/)).toBeInTheDocument();
    expect(document.querySelector('[data-aviso-del-micro]')).toHaveClass('bg-brass-bright');
  });

  /** El cambio se anuncia, pero no durante la toma (adr/0072): el micro lo oiría. */
  it('anuncia el cambio, y calla mientras hay toma', () => {
    render(<ElegirMicro />);
    act(() => useMicrofono.getState().acciones.anunciar('Micrófono cambiado: Scarlett.'));
    const region = screen.getByText('Micrófono cambiado: Scarlett.');
    expect(region).toHaveAttribute('aria-live', 'polite');

    act(() => useClaqueta.getState().acciones.marcarToma(true));
    expect(region).toHaveAttribute('aria-live', 'off');

    act(() => {
      useClaqueta.getState().acciones.marcarToma(false);
      useSessionStore.getState().actions.startCapture(0);
    });
    expect(region).toHaveAttribute('aria-live', 'off');
  });
});
