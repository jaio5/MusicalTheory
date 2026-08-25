/**
 * El muñeco: un amplificador con cara.
 *
 * No es un búho ni un profesor con birrete. Sale de lo que ya es esta aplicación
 * —chasis de madera, rejilla, latón— y así no parece traído de otra. Tiene cuerpo
 * y no solo cabeza, que es lo que le da aire de personaje: asas, patas y un
 * piloto que se enciende mientras está escuchando.
 *
 * Los ojos parpadean solos. Al hablar se le abre la boca y se le levantan las
 * cejas; callado mira de frente con media sonrisa.
 *
 * Vive en `ui/` y no dentro de aprender porque lo usan dos sitios que no se
 * conocen: el profesor que asoma en las unidades y la bienvenida de la pantalla
 * de registro. Un feature no importa de otro, y dibujar el muñeco dos veces
 * acabaría con dos muñecos distintos.
 */
export function Mascota({
  hablando = false,
  atento = false,
  className = 'size-14',
}: {
  /** Con la boca abierta y las cejas levantadas. */
  readonly hablando?: boolean;
  /** Con el piloto encendido: está escuchando. */
  readonly atento?: boolean;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`drop-shadow-lg ${className}`}
      role="img"
      aria-label="El profesor"
    >
      {/* El chasis */}
      <rect
        x="6"
        y="10"
        width="52"
        height="44"
        rx="6"
        className="fill-surface-raised stroke-brass-dim"
        strokeWidth="2"
      />

      {/* Las asas de los lados y las patas */}
      <g className="stroke-brass-dim" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M6 26h-3M6 34h-3M58 26h3M58 34h3" />
        <path d="M16 54v4M48 54v4" />
      </g>

      {/* La rejilla, como la tela de un ampli */}
      <g className="fill-brass-dim">
        {[14, 22, 30, 38, 46].map((x) => (
          <circle key={x} cx={x} cy="46" r="1.3" opacity="0.45" />
        ))}
      </g>

      {/* Las cejas, que se levantan al hablar */}
      <g
        className="stroke-text"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        style={{
          transform: hablando ? 'translateY(-1.5px)' : 'none',
          transition: 'transform 150ms',
        }}
      >
        <path d="M17.5 21c2-1.6 5-1.6 7 0" />
        <path d="M39.5 21c2-1.6 5-1.6 7 0" />
      </g>

      {/* Los ojos, con su brillo */}
      <g className="animate-parpadeo" style={{ transformOrigin: 'center 28px' }}>
        <circle cx="21.5" cy="28" r="4.2" className="fill-text" />
        <circle cx="42.5" cy="28" r="4.2" className="fill-text" />
        <circle cx="23" cy="26.5" r="1.4" className="fill-surface-raised" />
        <circle cx="44" cy="26.5" r="1.4" className="fill-surface-raised" />
      </g>

      {/* La boca: un óvalo que se mueve al hablar, media sonrisa al callar */}
      {hablando ? (
        <ellipse
          cx="32"
          cy="38"
          rx="5.5"
          ry="3.5"
          className="fill-brass animate-hablar"
          style={{ transformOrigin: 'center 38px' }}
        />
      ) : (
        <path
          d="M26 37.5c2.4 2.6 9.6 2.6 12 0"
          fill="none"
          className="stroke-brass"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {/* El piloto: encendido mientras está abierto y escuchando */}
      <circle cx="52" cy="16" r="2.2" className={atento ? 'fill-tube-bright' : 'fill-border'} />
    </svg>
  );
}
