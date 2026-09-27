/**
 * Una figura suelta, dibujada, para poder elegir cuánto dura lo que escribes.
 *
 * **Dibujada y no escrita con un carácter**, por lo mismo que la clave de sol:
 * los símbolos musicales de Unicode no están en las fuentes del sistema y salen
 * como un cuadro vacío. Y no con la palabra sola —«negra», «corchea»— porque
 * quien monta un punteo mirando una rejilla reconoce la figura antes que el
 * nombre; el nombre va en el `aria-label`, que es donde sirve.
 *
 * Las proporciones son las del pentagrama, en pequeño: la cabeza ocupa un
 * espacio, va inclinada, la plica sale de su canto y el puntillo se pone detrás.
 *
 * **Lo que se dibuja de cada duración lo dice el dominio** (`figuraDe`), que es lo
 * que hace que esto y el pentagrama no puedan decir cosas distintas: lo decían, y
 * la semicorchea salía aquí con un corchete y allí con dos.
 */

import { figuraDe } from '@core/music';

/** Medio espacio, que es de donde salen todas las medidas de aquí. */
const PASO = 3.2;
const CABEZA_RY = PASO;
const CABEZA_RX = PASO * 1.32;
const INCLINACION = 20;
const MEDIO_ANCHO = Math.hypot(
  CABEZA_RX * Math.cos((INCLINACION * Math.PI) / 180),
  CABEZA_RY * Math.sin((INCLINACION * Math.PI) / 180),
);
const PLICA = 3.5 * 2 * PASO;
/** Lo que baja el segundo corchete respecto al primero. */
const SEPARACION_CORCHETES = 4;

export function nombreDeFigura(length: number): string {
  return figuraDe(length).nombre;
}

export interface FiguraProps {
  /** La duración en pulsos: una de las siete que el modelo sabe escribir. */
  readonly length: number;
}

export function Figura({ length }: FiguraProps) {
  const { hueca, plica, corchetes, punto } = figuraDe(length);

  const x = 8;
  const y = 24;

  return (
    <svg width={22} height={30} viewBox="0 0 22 30" aria-hidden className="block">
      <ellipse
        cx={x}
        cy={y}
        rx={CABEZA_RX}
        ry={CABEZA_RY}
        transform={`rotate(-${INCLINACION} ${x} ${y})`}
        fill={hueca ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={hueca ? 1.2 : 0.8}
      />
      {punto && <circle cx={x + MEDIO_ANCHO + 3} cy={y} r={1.1} fill="currentColor" />}
      {plica && (
        <line
          x1={x + MEDIO_ANCHO}
          x2={x + MEDIO_ANCHO}
          y1={y}
          y2={y - PLICA}
          stroke="currentColor"
          strokeWidth={1}
        />
      )}
      {/* Uno la corchea y **dos la semicorchea**: el número de corchetes es la
          figura, así que con uno solo las dos se dibujaban igual. */}
      {Array.from({ length: corchetes }, (_, i) => (
        <path
          key={i}
          d={`M ${x + MEDIO_ANCHO} ${y - PLICA + i * SEPARACION_CORCHETES} q 5 3 4 8`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}
