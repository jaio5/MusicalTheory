// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  MESES_GRATIS_AL_AÑO,
  monthlyAiRequests,
  PAID_PLANS,
  PLANS,
  priceLabel,
  type Account,
} from '@core/billing';
import { AccountProvider } from '@state/account';

import { ETIQUETAS, PlanCards } from './PlanCards';

function pintar(account: Account) {
  render(
    <AccountProvider account={account} accounts>
      <PlanCards />
    </AccountProvider>,
  );
}

const ANONIMO: Account = {
  email: null,
  name: null,
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: null,
  aiLeftMonth: null,
};
const EN_MEDIO: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 100,
  aiLeftMonth: 100,
};

/** La tarjeta de un plan, para no confundir su precio con su nombre. */
function tarjeta(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('article')!;
}

describe('Las tarjetas de los planes', () => {
  // El gratis no es una opción que se elija: es lo que tienes. Ponerlo aquí haría
  // que la decisión pareciera de tres cuando es de dos (adr/0104).
  it('enseña los dos de pago y no el gratis', () => {
    pintar(ANONIMO);

    expect(screen.getAllByRole('article')).toHaveLength(2);
    for (const plan of PAID_PLANS) {
      expect(screen.getByRole('heading', { name: plan.name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Gratis' })).not.toBeInTheDocument();
  });

  /**
   * El cupo que se enseña sale del modelo de coste, no de la tabla de planes: es el
   * mismo número que el servidor va a hacer cumplir, porque los dos salen de
   * dividir el presupuesto del plan entre el coste de una petición.
   */
  it('cada uno con su precio y el cupo que da con el modelo puesto', () => {
    pintar(ANONIMO);

    for (const plan of PAID_PLANS) {
      const texto = tarjeta(plan.name).textContent ?? '';
      expect(texto).toContain(priceLabel(plan.id));
      // Y el anual, con sus meses gratis (adr/0106).
      expect(texto).toContain(
        `o ${priceLabel(plan.id, 'anual')}: ${MESES_GRATIS_AL_AÑO} meses gratis`,
      );
      expect(texto).toContain(
        `${monthlyAiRequests(plan.id, ANONIMO.aiModel)} preguntas al profesor al mes`,
      );
    }
  });

  // El cupo se cuenta en preguntas y una salida gasta varias: lo dice donde hay
  // salidas, y solo ahí (adr/0067).
  it('donde hay salidas dice cuántas preguntas gasta una', () => {
    pintar(ANONIMO);

    expect(tarjeta('Básico').textContent).not.toContain('una salida gasta');
    expect(tarjeta('Medio').textContent).toContain('una salida gasta 3');
  });

  it('un modelo más barato enseña un cupo más grande', () => {
    pintar({ ...ANONIMO, aiModel: 'claude-haiku-4-5' });

    const conHaiku = monthlyAiRequests('basico', 'claude-haiku-4-5');
    expect(tarjeta('Básico').textContent).toContain(`${conHaiku} preguntas al profesor al mes`);
    expect(conHaiku).toBeGreaterThan(monthlyAiRequests('basico', 'claude-opus-5'));
  });

  /**
   * Lo que enseña cada tarjeta sale de la tabla de permisos, no de una lista
   * escrita a mano: una tabla de precios que miente es peor que no tenerla, y la
   * forma de que mienta es escribirla dos veces.
   */
  /**
   * La misma lista, en el mismo orden, en todas: cada plan ponía lo suyo
   * delante y la misma prestación caía en filas distintas, así que no se podían
   * comparar.
   */
  it('las tarjetas llevan las mismas filas en el mismo orden', () => {
    pintar(ANONIMO);

    const filas = (nombre: string) =>
      within(tarjeta(nombre))
        .getAllByRole('listitem')
        .slice(0, ETIQUETAS.length)
        .map((fila) => fila.textContent?.replace(/^[✓—]|nuevo$|Incluye: |No incluye: /g, ''));

    expect(filas('Básico')).toEqual(ETIQUETAS.map(({ label }) => label));
    expect(filas('Medio')).toEqual(filas('Básico'));
  });

  // El lector de pantalla no oye una raya ni un tachado: lo que no entra se dice.
  it('lo que no entra se dice con palabras, y lo que sí también', () => {
    pintar(ANONIMO);

    const basico = within(tarjeta('Básico'));
    expect(basico.getByText('Salidas de lo que tocas').closest('li')).toHaveTextContent(
      /^—No incluye: Salidas/,
    );
    expect(basico.getByText('Preguntar al profesor').closest('li')).toHaveTextContent(
      /^✓Incluye: Preguntar/,
    );
  });

  // «nuevo» es lo que añade respecto al plan de debajo, no lo que tiene.
  it('marca como nuevo lo que cada plan añade al de debajo, y solo si lo tiene', () => {
    pintar(ANONIMO);

    const nuevos = (nombre: string) =>
      within(tarjeta(nombre))
        .queryAllByText('nuevo')
        .map((marca) => marca.closest('li')?.textContent ?? '');

    expect(nuevos('Básico').length).toBeGreaterThan(0);
    // Medio añade las salidas (adr/0066) y el profesor que sabe por dónde vas,
    // que traía Pro antes de fundirse en él (adr/0104).
    expect(nuevos('Medio')).toEqual([
      '✓Incluye: Salidas de lo que tocasnuevo',
      '✓Incluye: Un profesor que sabe por dónde vasnuevo',
    ]);
    for (const nombre of ['Básico', 'Medio']) {
      for (const fila of nuevos(nombre)) {
        expect(fila).toMatch(/^✓/);
      }
    }
  });

  // La mono es para la cifra, no para la frase (adr/0024).
  it('la monoespaciada es solo para las cifras', () => {
    pintar(ANONIMO);

    for (const cifra of tarjeta('Medio').querySelectorAll('.font-mono')) {
      expect(cifra.textContent).toMatch(/^[\d,]+( €)?$/);
    }
  });

  it('cada tarjeta lleva a su ventana de pago, y no cobra desde aquí', () => {
    pintar(ANONIMO);

    for (const plan of PAID_PLANS) {
      expect(
        within(tarjeta(plan.name)).getByRole('link', { name: `Elegir ${plan.name}` }),
      ).toHaveAttribute('href', `/planes/${plan.id}`);
    }
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('marca el que ya tienes y no ofrece comprarlo otra vez', () => {
    pintar(EN_MEDIO);

    expect(within(tarjeta('Medio')).getByText('Es el que tienes')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Elegir Medio' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir Básico' })).toBeInTheDocument();
  });

  // Los planes se llamaron Estudiante y Conservatorio antes de ser tres, y Pro se
  // fundió en Medio: quien lo tenga guardado ve Medio como el suyo.
  it('reconoce el nombre viejo del plan que tienes guardado', () => {
    pintar({
      email: 'javier@example.com',
      name: null,
      plan: 'estudiante' as Account['plan'],
      aiModel: 'claude-opus-5',
      aiLeftToday: 10,
      aiLeftMonth: 10,
    });

    expect(within(tarjeta('Básico')).getByText('Es el que tienes')).toBeInTheDocument();
  });

  it('quien tenía Pro tiene Medio', () => {
    pintar({ ...EN_MEDIO, plan: 'pro' as Account['plan'] });

    expect(within(tarjeta('Medio')).getByText('Es el que tienes')).toBeInTheDocument();
  });

  it('no se inventa planes: son los del catálogo', () => {
    pintar(ANONIMO);

    expect(PAID_PLANS.length).toBe(PLANS.length - 1);
  });

  /**
   * Se recomienda uno, y **por lo que hace**: no se ha vendido ni uno, así que
   * «el más elegido» sería un dato inventado.
   */
  it('recomienda un plan, con su razon, y solo uno', () => {
    render(<PlanCards />);

    const marcas = screen.getAllByText('El que recomendamos');
    expect(marcas).toHaveLength(1);

    const tarjeta = marcas[0]!.closest('article');
    expect(within(tarjeta!).getByRole('heading')).toHaveTextContent('Medio');
    expect(tarjeta!.textContent).toContain('IA que propone mientras compones');
  });

  /**
   * Botones de latón iguales decían que las opciones pesan lo mismo. El
   * recomendado va encendido y lleno; el otro, en contorno.
   */
  it('el recomendado se ve: tarjeta encendida y el único botón lleno', () => {
    pintar(ANONIMO);

    expect(tarjeta('Medio')).toHaveClass('superficie-viva');
    expect(tarjeta('Básico')).toHaveClass('superficie');
    expect(screen.getByRole('link', { name: 'Elegir Medio' })).toHaveClass('bg-brass');
    expect(screen.getByRole('link', { name: 'Elegir Básico' })).not.toHaveClass('bg-brass');
    expect(screen.getByRole('link', { name: 'Elegir Básico' })).toHaveClass('border');
  });

  // Quien ya paga ya eligió: encendida va la suya, y solo la suya.
  it('con un plan de pago, la encendida es la tuya y no la recomendada', () => {
    pintar({ ...EN_MEDIO, plan: 'basico' });

    expect(tarjeta('Básico')).toHaveClass('superficie-viva');
    expect(tarjeta('Medio')).not.toHaveClass('superficie-viva');
  });

  /** Y la lista enseña lo que prometen los reclamos, que faltaban dos. */
  it('enseña guardar canciones y las salidas, que son lo que distingue a dos planes', () => {
    render(<PlanCards />);

    expect(screen.getAllByText('Guardar tus canciones en la cuenta')).toHaveLength(2);
    expect(screen.getAllByText('Salidas de lo que tocas')).toHaveLength(2);
  });
});
