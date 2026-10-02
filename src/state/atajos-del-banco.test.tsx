// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useBancoStore } from './banco';
import { DEFAULT_BANCO } from './workspace';

import { useAtajosDelBanco } from './atajos-del-banco';

/**
 * Las teclas del banco de trabajo.
 *
 * Existen porque las áreas se pueden esconder, y
 * [adr/0031](../../docs/adr/0031-componer-es-un-banco-de-trabajo.md) dice que lo
 * que se puede esconder tiene que poder devolverse con una tecla. Lo que hay que
 * probar no es que la tecla llame a la acción: es **que no salte cuando se está
 * escribiendo**, que es la trampa de no llevar modificador.
 */
function Banco({ hayBanco = true }: { readonly hayBanco?: boolean }) {
  useAtajosDelBanco(hayBanco);
  return <input aria-label="tempo" type="number" />;
}

beforeEach(() => {
  localStorage.clear();
  useBancoStore.setState({
    espacio: DEFAULT_BANCO.espacio,
    repartos: DEFAULT_BANCO.repartos,
  });
});

describe('las teclas del banco', () => {
  it('los numeros eligen espacio de trabajo', async () => {
    render(<Banco />);

    await userEvent.keyboard('2');
    expect(useBancoStore.getState().espacio).toBe('escribir');

    await userEvent.keyboard('3');
    expect(useBancoStore.getState().espacio).toBe('ensayar');
  });

  it('los corchetes pliegan cada lado, y lo devuelven', async () => {
    useBancoStore.getState().actions.espacio('escribir');
    render(<Banco />);
    const plegadas = () => useBancoStore.getState().repartos.escribir.plegadas;

    await userEvent.keyboard('[[');
    expect(plegadas()).not.toContain('izquierda');

    await userEvent.keyboard('[[');
    expect(plegadas()).toContain('izquierda');
  });

  /**
   * La tecla que las devuelve todas. Es la que el ADR exige: quien pliega las
   * cuatro se queda mirando una pantalla vacía, y sin esto no hay salida.
   */
  it('la barra devuelve el reparto entero', async () => {
    useBancoStore.getState().actions.espacio('escribir');
    useBancoStore.getState().actions.plegar('derecha');
    render(<Banco />);

    await userEvent.keyboard('\\');

    expect(useBancoStore.getState().repartos.escribir).toEqual(DEFAULT_BANCO.repartos.escribir);
  });

  /**
   * La trampa de no llevar modificador: poner un «2» en el tempo no puede
   * cambiar de espacio, ni escribir «ensayar» en el nombre de una parte.
   */
  it('escribiendo en un campo no salta ninguna', async () => {
    render(<Banco />);
    const campo = screen.getByLabelText('tempo');

    await userEvent.click(campo);
    await userEvent.keyboard('2');

    expect(useBancoStore.getState().espacio).toBe(DEFAULT_BANCO.espacio);
  });

  // Con un modificador es un atajo del navegador o del sistema, no nuestro.
  it('con control o comando tampoco', async () => {
    render(<Banco />);

    await userEvent.keyboard('{Control>}2{/Control}');

    expect(useBancoStore.getState().espacio).toBe(DEFAULT_BANCO.espacio);
  });

  /**
   * **Con un teclado español, los corchetes y la barra piden AltGr**, y Windows
   * lo manda como Ctrl+Alt. Con la regla de «modificador, no es nuestro», ninguno
   * de los tres se podía pulsar. Lo que llega en `key` es el carácter que salió,
   * y eso es lo que manda.
   */
  describe('con un teclado que pide AltGr', () => {
    function pulsar(init: KeyboardEventInit) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
      });
    }

    beforeEach(() => {
      useBancoStore.getState().actions.espacio('escribir');
    });

    const plegadas = () => useBancoStore.getState().repartos.escribir.plegadas;

    // Aunque llegue con Control puesto: si el navegador dice que es AltGr, lo es.
    it('AltGr reconocido como tal pliega', () => {
      render(<Banco />);
      const antes = plegadas().includes('derecha');

      pulsar({ key: ']', ctrlKey: true, modifierAltGraph: true } as KeyboardEventInit);

      expect(plegadas().includes('derecha')).toBe(!antes);
    });

    it('Ctrl+Alt, que es como llega AltGr en Windows, también', () => {
      render(<Banco />);
      const antes = plegadas().includes('izquierda');

      pulsar({ key: '[', ctrlKey: true, altKey: true });

      expect(plegadas().includes('izquierda')).toBe(!antes);
    });

    it('y Opción en un Mac, que también los pide', () => {
      useBancoStore.getState().actions.plegar('derecha');
      render(<Banco />);

      pulsar({ key: '\\', altKey: true });

      expect(useBancoStore.getState().repartos.escribir).toEqual(DEFAULT_BANCO.repartos.escribir);
    });

    // Control sin Alt sí es un atajo de verdad, y Comando también.
    it('Control solo o Comando siguen sin ser nuestros', () => {
      render(<Banco />);
      const antes = [...plegadas()];

      pulsar({ key: '[', ctrlKey: true });
      pulsar({ key: ']', metaKey: true });

      expect(plegadas()).toEqual(antes);
    });

    // Los números no piden AltGr en ningún teclado: con modificador, del navegador.
    it('los numeros con Alt o Ctrl+Alt no cambian de espacio', () => {
      render(<Banco />);

      pulsar({ key: '1', altKey: true });
      pulsar({ key: '1', ctrlKey: true, altKey: true });

      expect(useBancoStore.getState().espacio).toBe('escribir');
    });
  });

  // Abajo de `lg` las áreas van en pestañas: plegar no se ve, así que la tecla
  // cambiaría un estado invisible. Elegir espacio sí se nota, y sigue.
  it('sin banco, los numeros siguen y los corchetes no', async () => {
    render(<Banco hayBanco={false} />);

    await userEvent.keyboard('2');
    expect(useBancoStore.getState().espacio).toBe('escribir');

    const antes = useBancoStore.getState().repartos.escribir.plegadas;
    await userEvent.keyboard('[[');
    expect(useBancoStore.getState().repartos.escribir.plegadas).toEqual(antes);
  });

  // Quitada la pantalla, la tecla deja de escuchar: si no, cada visita a
  // componer dejaría un oyente más pegado a la ventana.
  it('al salir de la pantalla se desenganchan', async () => {
    const { unmount } = render(<Banco />);
    unmount();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    });

    expect(useBancoStore.getState().espacio).toBe(DEFAULT_BANCO.espacio);
  });
});

describe('donde el foco no es un elemento', () => {
  /**
   * Sin nada enfocado el evento llega con `target` en el documento, que no es un
   * `HTMLElement`: ahí no se está escribiendo, así que el atajo salta.
   */
  it('el atajo salta igual', () => {
    render(<Banco />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    });

    expect(useBancoStore.getState().espacio).toBe('escribir');
  });

  // Y sobre algo que se puede editar a mano, no: se está escribiendo.
  it('y sobre algo editable, no', async () => {
    render(
      <>
        <Banco />
        <div contentEditable aria-label="nota" tabIndex={0} suppressContentEditableWarning />
      </>,
    );
    const editable = screen.getByLabelText('nota');
    // jsdom no implementa `isContentEditable`: siempre contesta que no, así que
    // se le pone a mano lo que el navegador de verdad diría.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    editable.focus();

    await userEvent.keyboard('2');

    expect(useBancoStore.getState().espacio).toBe(DEFAULT_BANCO.espacio);
  });
});
