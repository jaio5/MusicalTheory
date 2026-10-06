// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { microfonoElegido, nombreDeLaEntrada, useMicrofono } from './microfono';

const LISTA = [
  { deviceId: 'default', label: 'Por defecto - Portátil', kind: 'audioinput' },
  { deviceId: 'portatil', label: 'Portátil', kind: 'audioinput' },
  { deviceId: 'rara', label: '', kind: 'audioinput' },
] as MediaDeviceInfo[];

const guardado = () => JSON.parse(localStorage.getItem('caos-ordenado:workspace')!).microfono;

beforeEach(() => {
  localStorage.clear();
  useMicrofono.setState({
    elegido: null,
    nombreElegido: '',
    cargado: false,
    entradas: [],
    cayo: false,
    pendiente: false,
    anuncio: '',
  });
});

describe('la elección del micrófono', () => {
  it('se guarda con su nombre, y se vuelve a leer', () => {
    const { acciones } = useMicrofono.getState();
    acciones.ponerEntradas(LISTA);
    acciones.elegir('portatil');

    expect(guardado()).toEqual({ id: 'portatil', nombre: 'Portátil' });

    useMicrofono.setState({ elegido: null, cargado: false });
    expect(microfonoElegido()).toBe('portatil');
    expect(useMicrofono.getState().nombreElegido).toBe('Portátil');
  });

  it('el del sistema se guarda como nada', () => {
    useMicrofono.getState().acciones.elegir(null);

    expect(guardado()).toBeNull();
    expect(microfonoElegido()).toBeNull();
  });

  // Elegido sin permiso, el navegador no da el nombre: se guarda sin él.
  it('uno que no está en la lista se guarda sin nombre', () => {
    useMicrofono.getState().acciones.elegir('otra');

    expect(guardado()).toEqual({ id: 'otra', nombre: '' });
  });

  /**
   * Con «permitir solo esta vez», el navegador da otro identificador en cada
   * página: el elegido se perdía al recargar. Se le reconoce por el nombre.
   */
  it('si cambia de identificador, se le reconoce por el nombre y se guarda el nuevo', () => {
    useMicrofono.setState({
      elegido: 'portatil-de-ayer',
      nombreElegido: 'Portátil',
      cargado: true,
    });

    useMicrofono.getState().acciones.ponerEntradas(LISTA);

    expect(useMicrofono.getState().elegido).toBe('portatil');
    expect(guardado()).toEqual({ id: 'portatil', nombre: 'Portátil' });
  });

  it('sin nadie que se llame igual, se queda como estaba', () => {
    useMicrofono.setState({ elegido: 'otra', nombreElegido: 'Otra', cargado: true });

    useMicrofono.getState().acciones.ponerEntradas(LISTA);

    expect(useMicrofono.getState().elegido).toBe('otra');
  });

  it('sin nombre guardado no se adivina', () => {
    useMicrofono.setState({ elegido: 'otra', nombreElegido: '', cargado: true });

    useMicrofono.getState().acciones.ponerEntradas(LISTA);

    expect(useMicrofono.getState().elegido).toBe('otra');
  });

  it('caer y volver solo cambia el estado si cambia', () => {
    const { acciones } = useMicrofono.getState();
    const antes = useMicrofono.getState();
    acciones.marcarCaida(false);
    expect(useMicrofono.getState()).toBe(antes);

    acciones.marcarCaida(true);
    expect(useMicrofono.getState().cayo).toBe(true);
    // Elegir otro lo da por resuelto.
    acciones.elegir(null);
    expect(useMicrofono.getState().cayo).toBe(false);
  });
});

describe('cómo se llama cada uno', () => {
  const estado = (elegido: string | null, nombreElegido = '') => ({
    entradas: [
      { id: 'portatil', nombre: 'Portátil' },
      { id: 'rara', nombre: '' },
    ],
    elegido,
    nombreElegido,
  });

  it('el del sistema, por su papel', () => {
    expect(nombreDeLaEntrada(null, estado(null))).toBe('El del sistema');
  });

  it('el de la lista, por su nombre, y sin nombre, por su sitio', () => {
    expect(nombreDeLaEntrada('portatil', estado(null))).toBe('Portátil');
    expect(nombreDeLaEntrada('rara', estado(null))).toBe('Entrada sin nombre 2');
  });

  it('el que no está, por el nombre que tenía, o por ser el elegido', () => {
    expect(nombreDeLaEntrada('ida', estado('ida', 'Scarlett'))).toBe('Scarlett');
    expect(nombreDeLaEntrada('ida', estado('ida'))).toBe('El que elegiste');
    expect(nombreDeLaEntrada('ida', estado('otra', 'Scarlett'))).toBe('El que elegiste');
  });
});
