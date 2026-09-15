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
 */

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

/** Cómo se llama cada duración, que es lo que oye quien no ve el dibujo. */
export const NOMBRE_DE_FIGURA: Readonly<Record<number, string>> = {
  0.5: 'corchea',
  1: 'negra',
  1.5: 'negra con puntillo',
  2: 'blanca',
  3: 'blanca con puntillo',
  4: 'redonda',
};

export function nombreDeFigura(length: number): string {
  return NOMBRE_DE_FIGURA[length] ?? `${length} pulsos`;
}

export interface FiguraProps {
  /** La duración en pulsos: una de las seis que el modelo sabe escribir. */
  readonly length: number;
}

export function Figura({ length }: FiguraProps) {
  const hueca = length >= 2;
  const plica = length < 4;
  const corchete = length < 1;
  const punto = length === 1.5 || length === 3;

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
      {corchete && (
        <path
          d={`M ${x + MEDIO_ANCHO} ${y - PLICA} q 5 3 4 8`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
        />
      )}
    </svg>
  );
}
