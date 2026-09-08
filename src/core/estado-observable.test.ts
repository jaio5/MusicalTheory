import { describe, expect, it, vi } from 'vitest';

import { EstadoObservable } from './estado-observable';

describe('EstadoObservable', () => {
  it('empieza en el valor con el que se construye', () => {
    expect(new EstadoObservable('idle').valor).toBe('idle');
  });

  it('avisa a quien se apunta cuando cambia', () => {
    const estado = new EstadoObservable<'idle' | 'running'>('idle');
    const oyente = vi.fn();
    estado.suscribir(oyente);

    estado.cambiarA('running');

    expect(oyente).toHaveBeenCalledExactlyOnceWith('running');
    expect(estado.valor).toBe('running');
  });

  // Es la razón de que exista la comparación: quien escucha suele repintar.
  it('no avisa si el estado no cambia', () => {
    const estado = new EstadoObservable('idle');
    const oyente = vi.fn();
    estado.suscribir(oyente);

    estado.cambiarA('idle');

    expect(oyente).not.toHaveBeenCalled();
  });

  it('la baja deja de recibir avisos', () => {
    const estado = new EstadoObservable<'idle' | 'running'>('idle');
    const oyente = vi.fn();
    const baja = estado.suscribir(oyente);

    baja();
    estado.cambiarA('running');

    expect(oyente).not.toHaveBeenCalled();
  });

  it('avisa a todos los apuntados, en orden', () => {
    const estado = new EstadoObservable<'idle' | 'running'>('idle');
    const vistos: string[] = [];
    estado.suscribir(() => vistos.push('primero'));
    estado.suscribir(() => vistos.push('segundo'));

    estado.cambiarA('running');

    expect(vistos).toEqual(['primero', 'segundo']);
  });
});
