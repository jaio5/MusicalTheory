'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  ladoMasCercano,
  moverTutor,
  sitioDelTutor,
  sitioDelTutorEnServidor,
  suscribirseAlSitio,
} from '@state/tutor-spot';
import { Mascota } from '@ui/Mascota';
import { prefersReducedMotion } from '@ui/motion';

import { Teacher } from './Teacher';

/**
 * El profesor, con cara y a mano.
 *
 * Vive en la esquina de abajo de las pantallas de aprender, y hace dos cosas
 * distintas según quién dé el paso:
 *
 * - **Tú lo llamas.** Está siempre ahí, del tamaño de un pulgar. Se pulsa y se
 *   abre con el formulario dentro, así que preguntar no obliga a salir de la
 *   unidad, ir a otra pantalla y perder por dónde ibas. Antes solo había un
 *   enlace, y un enlace en mitad de un ejercicio no lo pulsa nadie.
 * - **Él te llama.** Cuando fallas una pregunta se abre solo con la frase puesta,
 *   que es el momento exacto en que uno piensa «¿y por qué?».
 *
 * **No sale a saludar ni a felicitar por respirar.** Cerrado no dice nada, y solo
 * se abre por su cuenta cuando algo ha salido mal. Un ayudante que aparece sin
 * motivo es lo que hizo que todo el mundo odiara al clip de Office: se aprende a
 * cerrarlo sin leerlo, y el día que dice algo útil ya nadie lo mira.
 *
 * Habla escribiendo, letra a letra y directamente en el DOM: por el estado eran
 * cien renders de React por frase. Nada de voz sintética, que suena a robot y se
 * pisa con lo que estés tocando. Para quien no ve la pantalla, el globo lleva la
 * frase entera desde el primer momento —anunciarla letra a letra sería
 * inservible— y con `prefers-reduced-motion` no entra deslizándose ni escribe.
 *
 * **Se agarra y se mueve.** Al soltarlo se va al lado más cercano —solo izquierda
 * o derecha— y se queda a la altura donde lo dejaste. Los dos lados y no donde
 * caiga, porque un muñeco suelto en mitad de la pantalla acaba tapando justo lo
 * que estabas leyendo; y la altura sí, porque es lo que cambia según lo que
 * estorbe en cada pantalla. El sitio se recuerda entre pantallas y entre
 * sesiones: lo guarda `state/tutor-spot`.
 */
export function Tutor({
  unitId,
  aviso = null,
  onAvisoVisto,
}: {
  /** La lección que se está leyendo, para que responda en ese contexto. */
  readonly unitId?: string;
  /** Lo que el muñeco tiene que decir por su cuenta, si hay algo. */
  readonly aviso?: string | null;
  readonly onAvisoVisto?: () => void;
}) {
  const sitio = useSyncExternalStore(suscribirseAlSitio, sitioDelTutor, sitioDelTutorEnServidor);
  const [quieto] = useState(prefersReducedMotion);
  const marco = useRef<HTMLDivElement>(null);
  // Mientras se arrastra, la posición se escribe directamente en el estilo del
  // elemento: pasarla por el estado serían sesenta renders por segundo mientras
  // el dedo se mueve, y lo que se mueve es un solo `transform`.
  const arrastre = useRef<{ dx: number; dy: number; movido: boolean } | null>(null);
  // Si ya viene con algo que decir, nace abierto: comparar solo el cambio dejaba
  // callado al muñeco que se monta ya con el aviso puesto.
  const [abierto, setAbierto] = useState(aviso !== null);
  // Empieza a hablar en el momento en que se abre, no dentro del efecto: poner
  // estado en el cuerpo de un efecto encadena un render de más, y la regla de
  // React que lo prohíbe está encendida en este proyecto.
  const [hablando, setHablando] = useState(aviso !== null && !prefersReducedMotion());
  const globo = useRef<HTMLSpanElement>(null);

  const frase = aviso ?? '¿Qué quieres saber? Te lo explico con los acordes de tu tonalidad.';

  // Un aviso nuevo lo abre. Se compara durante el render, como en el resto de la
  // aplicación: en un efecto se vería un fotograma con la frase anterior.
  const [avisado, setAvisado] = useState(aviso);
  if (avisado !== aviso) {
    setAvisado(aviso);
    if (aviso !== null) {
      setAbierto(true);
      setHablando(!quieto);
    }
  }

  useEffect(() => {
    if (!abierto) {
      return;
    }
    if (quieto) {
      if (globo.current !== null) {
        globo.current.textContent = frase;
      }
      return;
    }

    const inicio = performance.now();
    let cuadro = 0;

    const paso = (ahora: number) => {
      const cuantas = Math.min(frase.length, Math.floor((ahora - inicio) / 18));
      if (globo.current !== null) {
        globo.current.textContent = frase.slice(0, cuantas);
      }
      if (cuantas < frase.length) {
        cuadro = requestAnimationFrame(paso);
      } else {
        setHablando(false);
      }
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [abierto, frase, quieto]);

  function agarrar(evento: React.PointerEvent<HTMLDivElement>): void {
    const caja = marco.current?.getBoundingClientRect();
    if (caja === undefined) {
      return;
    }
    // **Aquí no se captura el puntero.** Capturarlo al apoyar el dedo redirige
    // todos los eventos a este contenedor, y entonces el `click` deja de llegar
    // al botón de dentro: el muñeco se movía y no se abría. Se captura en cuanto
    // el dedo se mueve de verdad, que es cuando hace falta para no perderlo al
    // salirse del muñeco.
    arrastre.current = {
      dx: evento.clientX - caja.left,
      dy: evento.clientY - caja.top,
      movido: false,
    };
  }

  function mover(evento: React.PointerEvent<HTMLDivElement>): void {
    const agarre = arrastre.current;
    if (agarre === null || marco.current === null) {
      return;
    }
    // Cinco píxeles de margen: un dedo nunca pulsa completamente quieto, y sin
    // esto cada pulsación se leería como un arrastre y no abriría el globo.
    if (!agarre.movido && Math.abs(evento.movementX) + Math.abs(evento.movementY) < 5) {
      return;
    }
    if (!agarre.movido) {
      agarre.movido = true;
      evento.currentTarget.setPointerCapture(evento.pointerId);
    }
    marco.current.style.left = `${evento.clientX - agarre.dx}px`;
    marco.current.style.top = `${evento.clientY - agarre.dy}px`;
    marco.current.style.right = 'auto';
    marco.current.style.bottom = 'auto';
  }

  function soltar(evento: React.PointerEvent<HTMLDivElement>): void {
    const agarre = arrastre.current;
    arrastre.current = null;

    if (agarre === null || !agarre.movido || marco.current === null) {
      // Un toque sin arrastre no se toca: se deja pasar para que el navegador
      // dispare el `click` del botón y el muñeco se abra.
      return;
    }

    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }

    const caja = marco.current.getBoundingClientRect();
    moverTutor({
      lado: ladoMasCercano(caja.left + caja.width / 2, window.innerWidth),
      alto: (caja.top / window.innerHeight) * 100,
    });

    // Se devuelve el mando a las clases: el sitio ya está guardado, y dejar el
    // estilo puesto congelaría al muñeco donde lo soltó el dedo.
    marco.current.style.left = '';
    marco.current.style.top = '';
    marco.current.style.right = '';
    marco.current.style.bottom = '';
  }

  function cerrar(): void {
    setAbierto(false);
    setHablando(false);
    onAvisoVisto?.();
  }

  const derecha = sitio.lado === 'derecha';
  // Hacia dónde crece el globo. Si el muñeco está en la mitad de abajo se ancla
  // por abajo y el globo sube; si está arriba, al revés. Anclando siempre por
  // arriba, el globo empujaba al muñeco hacia abajo y los dos se salían de la
  // pantalla: parecía que desaparecía al pulsarlo.
  const arriba = sitio.alto < 50;

  return (
    <div
      ref={marco}
      onPointerDown={agarrar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      // La altura la pone el sitio guardado; el lado, una de las dos anclas. El
      // globo se abre hacia dentro de la pantalla, así que en el lado derecho la
      // fila se invierte y el pico del globo cambia de esquina.
      style={arriba ? { top: `${sitio.alto}%` } : { bottom: `${100 - sitio.alto}%` }}
      className={`fixed z-30 flex touch-none gap-2 ${arriba ? 'items-start' : 'items-end'} ${
        derecha ? 'right-3 flex-row-reverse' : 'left-3'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (abierto) {
            cerrar();
            return;
          }
          setAbierto(true);
          setHablando(!quieto);
        }}
        aria-expanded={abierto}
        aria-label={abierto ? 'Cerrar el profesor' : 'Preguntarle al profesor'}
        className={`shrink-0 rounded-full transition-transform duration-150 hover:scale-105 active:scale-100 ${
          quieto ? '' : 'animate-asomar'
        }`}
      >
        <Mascota hablando={hablando} atento={abierto} />
      </button>

      {abierto && (
        <div
          className={`superficie-alta w-[min(26rem,calc(100vw-6rem))] p-3 ${
            arriba
              ? derecha
                ? 'rounded-tr-none'
                : 'rounded-tl-none'
              : derecha
                ? 'rounded-br-none'
                : 'rounded-bl-none'
          } ${quieto ? '' : 'animate-asomar'}`}
        >
          <p className="text-text text-sm" aria-live="polite">
            <span aria-hidden="true" ref={globo} />
            <span className="sr-only">{frase}</span>
          </p>

          {/* El formulario de siempre, aquí dentro: preguntar no debería costar
              salirse de la unidad. Sin las preguntas de arranque, que en un globo
              ocupan más que el propio campo. */}
          <div className="mt-3">
            <Teacher unitId={unitId} compact />
          </div>

          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={cerrar}
              className="text-text-muted hover:text-text font-mono text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
