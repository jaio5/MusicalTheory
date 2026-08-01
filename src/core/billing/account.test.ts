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
