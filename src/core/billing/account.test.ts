import { describe, expect, it } from 'vitest';

import { ANONYMOUS, avatarInitial, displayName, isSignedIn, type Account } from './account';

function cuenta(cambios: Partial<Account> = {}): Account {
  return { ...ANONYMOUS, email: 'javier@example.com', ...cambios };
}

/**
 * De estas dos funciones sale lo que se lee en la barra de arriba, así que un
 * fallo aquí se ve en todas las pantallas a la vez.
 */
describe('cómo se te llama', () => {
  it('usa el nombre cuando lo has dicho', () => {
    expect(displayName(cuenta({ name: 'Javier' }))).toBe('Javier');
  });

  // El correo entero no cabe en la barra, y la mitad de detrás del arroba no
  // identifica a nadie: son todos el mismo servidor de correo.
  it('sin nombre, la parte del correo antes del arroba', () => {
    expect(displayName(cuenta())).toBe('javier');
  });

  it('un nombre en blanco es no haberlo dicho', () => {
    expect(displayName(cuenta({ name: '   ' }))).toBe('javier');
  });

  it('sin haber entrado no inventa un nombre', () => {
    expect(displayName(ANONYMOUS)).toBe('tu cuenta');
    expect(isSignedIn(ANONYMOUS)).toBe(false);
  });
});

describe('la letra del avatar', () => {
  it('es la primera del nombre, en mayúscula', () => {
    expect(avatarInitial(cuenta({ name: 'javier' }))).toBe('J');
  });

  it('sin nombre sale del correo', () => {
    expect(avatarInitial(cuenta({ email: 'ana@example.com' }))).toBe('A');
  });

  /**
   * Cortar por `[0]` parte en dos los caracteres que ocupan dos unidades —los
   * emoji y buena parte de los alfabetos que no son el latino— y lo que queda no
   * se pinta: sale el rombo con la interrogación.
   */
  it('no parte por la mitad un carácter que ocupa dos', () => {
    expect(avatarInitial(cuenta({ name: '🎸 Javier' }))).toBe('🎸');
    expect(avatarInitial(cuenta({ name: '日本' }))).toBe('日');
  });
});

/**
 * La inicial del avatar sale de cómo se te llama, y hay cuentas sin nombre y sin
 * correo: entonces no hay letra que poner. Se corta por puntos de código porque
 * un emoji o una letra con tilde compuesta se parten si se cortan por `[0]`.
 */
describe('la inicial del avatar', () => {
  it('sale del nombre, del correo o de nada', () => {
    expect(avatarInitial({ ...ANONYMOUS, name: 'javier' })).toBe('J');
    expect(avatarInitial({ ...ANONYMOUS, name: null, email: 'javier@example.com' })).toBe('J');
    // Sin nombre ni correo se cae en «tu cuenta», que empieza por t.
    expect(avatarInitial({ ...ANONYMOUS, name: null, email: null })).toBe('T');
    // Y con el nombre en blanco, que no es lo mismo que no tenerlo.
    expect(avatarInitial({ ...ANONYMOUS, name: '  ', email: null })).toBe('T');
  });
});
