import { describe, expect, it } from 'vitest';

import { can, PAID_PLANS } from '@core/billing';

import { enUnaFrase, loQueNoTrae, loQueSuma, loQueTrae } from './lo-que-va-con-plan';

/**
 * Lo que dicen las pantallas sobre lo que es gratis sale de la tabla de
 * permisos. Escrito a mano en cuatro sitios, se contradecía: «lo único que pide
 * cuenta es la IA» al lado de un repaso y unas canciones que piden el Básico.
 */
describe('lo que va con un plan', () => {
  it('el gratis no trae ni el repaso ni guardar canciones, que van con el Básico', () => {
    expect(can('gratis', 'repaso')).toBe(false);
    expect(loQueNoTrae('gratis')).toContain('El repaso de lo que fallaste');
    expect(loQueNoTrae('gratis')).toContain('Guardar tus canciones en la cuenta');
    expect(loQueSuma('basico')).toContain('El repaso de lo que fallaste');
    expect(loQueSuma('basico')).toContain('Guardar tus canciones en la cuenta');
  });

  it('el profesor lo trae el gratis, así que no es lo que se suma al pagar', () => {
    expect(loQueTrae('gratis')).toEqual(['Preguntar al profesor']);
    expect(loQueSuma('basico')).not.toContain('Preguntar al profesor');
  });

  it('lo que suma un plan se cuenta desde el de debajo', () => {
    const [basico, medio] = PAID_PLANS;
    expect(loQueSuma(medio!.id, basico!.id)).toEqual(['Salidas de lo que tocas']);
  });

  it('Pro lo trae todo', () => {
    expect(loQueNoTrae('pro')).toEqual([]);
  });
});

describe('una lista dentro de una frase', () => {
  it('comas y una «y» al final, con la primera letra en minúscula', () => {
    expect(enUnaFrase(['El repaso', 'Los seis cursos del Grado Profesional', 'Salidas'])).toBe(
      'el repaso, los seis cursos del Grado Profesional y salidas',
    );
  });

  it('una sola cosa va sola, y ninguna no dice nada', () => {
    expect(enUnaFrase(['El repaso'])).toBe('el repaso');
    expect(enUnaFrase([])).toBe('');
  });
});
