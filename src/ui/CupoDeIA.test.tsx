// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { CupoDeIA } from './CupoDeIA';

/**
 * Lo que te queda de IA, en la barra de arriba.
 *
 * Estaba solo **dentro** de los paneles que lo gastan, así que para saberlo
 * había que abrir el que ibas a usar
 * ([adr/0033](../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)).
 */
const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 8,
  aiLeftMonth: 45,
};

function pintar(account: Account) {
  return render(
    <AccountProvider account={account} accounts>
      <CupoDeIA />
    </AccountProvider>,
  );
}

describe('el cupo de IA en la barra', () => {
  /**
   * El rótulo es corto porque vive en una barra llena, y quien no ve los números
   * oye la frase entera: «IA dos punto cuarenta y cinco» no es un cupo.
   */
  it('se lee corto y se oye entero', () => {
    pintar(CON_PLAN);

    const enlace = screen.getByRole('link');
    expect(enlace).toHaveAccessibleName(/Te quedan 8 peticiones a la IA hoy y 45 este mes/);
    expect(enlace).toHaveAttribute('href', '/cuenta#suscripcion');
  });

  it('agotado lo dice, y no con un cero', () => {
    pintar({ ...CON_PLAN, aiLeftToday: 0 });

    expect(screen.getByRole('link')).toHaveAccessibleName(/Se te han acabado/);
  });

  /**
   * Sin cuenta no sale ningún número, y no es un olvido: el servidor cuenta por
   * dirección, así que no hay número que prometer.
   */
  it('sin cuenta no promete ningun numero', () => {
    const { container } = pintar(ANONYMOUS);

    expect(container).toBeEmptyDOMElement();
  });
});
