// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';
import { moverTutor, SITIO_POR_DEFECTO } from '@state/tutor-spot';

import { Tutor } from './Tutor';

function pintar(nodo: React.ReactNode) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={false}>
      {nodo}
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  moverTutor(SITIO_POR_DEFECTO);
});

describe('El muñeco del profesor', () => {
  // Cerrado no dice nada: un ayudante que habla sin motivo se aprende a cerrar
  // sin leerlo, y el día que dice algo útil ya nadie lo mira.
  it('empieza callado y solo se ve el muñeco', () => {
    pintar(<Tutor />);

    expect(screen.getByRole('button', { name: /preguntarle al profesor/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  /**
   * Lo que se pedía y no había: preguntar sin salirse de la unidad. El formulario
   * del profesor va dentro del globo, no detrás de un enlace a otra pantalla.
   */
  it('al pulsarlo se abre con el formulario de preguntar dentro', async () => {
    pintar(<Tutor unitId="e1-grados" />);

    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));

    expect(screen.getByRole('button', { name: /preguntar/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pregunta lo que quieras/i)).toBeInTheDocument();
  });

  it('se abre solo cuando hay algo que avisar, y con la frase entera para quien no ve', () => {
    pintar(<Tutor aviso="Esa no era." />);

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Esa no era.')).toBeInTheDocument();
  });

  it('se cierra y avisa de que ya se ha visto', async () => {
    const visto = vi.fn();
    pintar(<Tutor aviso="Esa no era." onAvisoVisto={visto} />);

    await userEvent.click(screen.getByRole('button', { name: /^cerrar$/i }));

    expect(visto).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  /**
   * El sitio sale del guardado, no de una clase fija: cada pantalla monta su
   * propio muñeco y todos tienen que aparecer donde lo dejaste.
   */
  it('se pinta en el lado y a la altura donde lo dejaste', () => {
    moverTutor({ lado: 'derecha', alto: 35 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('right-3');
    // La fila se invierte para que el globo se abra hacia dentro de la pantalla.
    expect(marco.className).toContain('flex-row-reverse');
    expect(marco.style.top).toBe('35%');
    expect(marco.className).toContain('items-start');
  });

  /**
   * El fallo que tuvo: capturar el puntero al apoyar el dedo redirige todos los
   * eventos al contenedor, y entonces el `click` no llega al botón de dentro. Se
   * movía y no se abría.
   *
   * jsdom no implementa la captura de verdad, así que lo que se vigila es **el
   * momento** en que se pide: al apoyar, nunca; al moverse, sí. Es lo que
   * distingue un toque de un arrastre.
   */
  it('no captura el puntero hasta que te mueves de verdad', () => {
    const capturar = vi.fn();
    const liberar = vi.fn();
    Element.prototype.setPointerCapture = capturar;
    Element.prototype.releasePointerCapture = liberar;
    Element.prototype.hasPointerCapture = () => true;

    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    expect(capturar, 'apoyar el dedo no puede capturar: se come el clic').not.toHaveBeenCalled();

    fireEvent.pointerMove(marco, { clientX: 200, clientY: 400, movementX: 180, pointerId: 1 });
    expect(capturar).toHaveBeenCalledOnce();
  });

  /**
   * El fallo que tuvo: anclado siempre por arriba, al abrirse el globo empujaba
   * al muñeco hacia abajo desde el 78 % y los dos se salían de la pantalla. Se
   * ancla por el borde más cercano, y así el globo crece hacia dentro.
   */
  it('abajo se ancla por abajo, para que el globo suba en vez de empujarlo fuera', () => {
    moverTutor({ lado: 'izquierda', alto: 78 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.style.bottom).toBe('22%');
    expect(marco.style.top).toBe('');
    expect(marco.className).toContain('items-end');
  });

  it('arriba se ancla por arriba, y entonces el globo baja', () => {
    moverTutor({ lado: 'izquierda', alto: 20 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.style.top).toBe('20%');
    expect(marco.style.bottom).toBe('');
    expect(marco.className).toContain('items-start');
  });

  it('en el lado de siempre se abre hacia el otro', () => {
    moverTutor(SITIO_POR_DEFECTO);
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('left-3');
    expect(marco.className).not.toContain('flex-row-reverse');
  });
});

describe('Arrastrar el muñeco', () => {
  /**
   * Se puede mover porque tapa cosas: en una unidad larga cae justo encima del
   * último ejercicio. Lo que se guarda no es la posición exacta sino **el lado
   * más cercano y la altura**, para que al cambiar de pantalla o girar el móvil
   * siga estando donde tiene sentido y no medio fuera.
   */
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = () => true;
    // El marco no tiene tamaño en jsdom, y de él sale el lado más cercano.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 700,
      top: 150,
      width: 60,
      height: 60,
    } as DOMRect);
    window.innerWidth = 1000;
    window.innerHeight = 600;
  });

  it('soltarlo a la derecha lo deja en ese lado, y a esa altura', () => {
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    expect(JSON.parse(localStorage.getItem('caos-ordenado:sitio-del-profesor')!)).toMatchObject({
      lado: 'derecha',
    });
  });

  it('al soltarlo se devuelve el mando a las clases', () => {
    // Dejar el estilo puesto congelaría al muñeco donde lo soltó el dedo, y al
    // cambiar de pantalla aparecería en un sitio que ya no significa nada.
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    // El `top` que queda no es el del dedo: es el del sitio guardado, en tanto
    // por ciento, que es lo que sobrevive a girar el móvil.
    expect(marco.style.left).toBe('');
    expect(marco.style.right).toBe('');
    expect(marco.style.top).toMatch(/%$/);
  });

  it('un toque sin arrastre no mueve nada: abre el globo', async () => {
    // Es lo que separa pulsarlo de moverlo, y por eso el `pointerup` sin
    // movimiento se deja pasar para que el navegador dispare el `click`.
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;
    const antes = localStorage.getItem('caos-ordenado:sitio-del-profesor');

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 21, clientY: 400, movementX: 1, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 21, clientY: 400, pointerId: 1 });
    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));

    expect(localStorage.getItem('caos-ordenado:sitio-del-profesor')).toBe(antes);
    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toBeInTheDocument();
  });

  it('cancelar el gesto —una llamada entrante— tampoco lo deja a medias', () => {
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerCancel(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    expect(marco.style.left).toBe('');
  });
});

describe('Cómo aparece la frase', () => {
  /**
   * La frase se escribe letra a letra, como si el muñeco la estuviera diciendo.
   * Es adorno, así que **quien ha pedido menos movimiento la ve entera de
   * golpe**: para alguien con sensibilidad al movimiento, un texto que se
   * escribe solo es exactamente lo que hace daño.
   *
   * Lo que no cambia en ninguno de los dos casos es la copia para lectores de
   * pantalla, que lleva la frase completa desde el primer momento: leer letra a
   * letra en voz alta no lo aguanta nadie.
   */
  it('con movimiento reducido, entera desde el primer fotograma', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })),
    );

    const { container } = pintar(<Tutor aviso="Otra vez esa." />);

    const globo = container.querySelector(
      '[aria-hidden="true"] + .sr-only',
    )?.previousElementSibling;
    expect(globo?.textContent).toBe('Otra vez esa.');
    vi.unstubAllGlobals();
  });

  it('sin movimiento reducido, se escribe sola hasta terminar', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
    // El reloj de la animación es `performance.now`, y los fotogramas los pide
    // `requestAnimationFrame`: los dos se mueven a mano.
    let ahora = 0;
    const reloj = vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    const pendientes: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pendientes.push(cb);
      return pendientes.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const { container } = pintar(<Tutor aviso="Hola." />);
    const globo = container.querySelector('p > span[aria-hidden="true"]');

    // A los 36 ms van dos letras: uno cada 18.
    ahora = 36;
    pendientes.shift()?.(36);
    expect(globo?.textContent).toBe('Ho');

    // Pasado el tiempo de la frase entera, está completa y deja de pedir cuadros.
    ahora = 1000;
    pendientes.shift()?.(1000);
    expect(globo?.textContent).toBe('Hola.');

    // Y la copia que lee un lector de pantalla la tuvo entera desde el principio.
    expect(container.querySelector('.sr-only')?.textContent).toBe('Hola.');

    reloj.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('Un aviso nuevo', () => {
  it('abre al muñeco aunque ya estuviera cerrado', async () => {
    const { rerender } = pintar(<Tutor />);
    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));
    await userEvent.click(screen.getByRole('button', { name: /cerrar el profesor/i }));

    rerender(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <Tutor aviso="Esa nota se resiste." />
      </AccountProvider>,
    );

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toBeInTheDocument();
  });
});
