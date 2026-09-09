/**
 * El muñeco: una válvula encendida.
 *
 * Fue un amplificador entero con cara, y a tamaño real no se reconocía: la
 * rejilla eran cinco puntos debajo de la boca —que leen como botones, no como
 * tela— y la cara ocupaba el chasis entero, así que no quedaba sitio para lo
 * único que lo habría identificado. Salía una tostadora con ojos.
 *
 * La válvula resuelve las dos cosas. Es el objeto **más reconocible** de este
 * mundo y el que mejor aguanta a cincuenta y seis píxeles, porque su silueta
 * —cúpula, zócalo y patillas— no depende de ningún detalle interior.
 *
 * **Se queda aunque la paleta ya no sea la de un amplificador**
 * ([adr/0027](../../docs/adr/0027-grafito-y-ambar.md)). No la sostenía el color:
 * la sostiene que una válvula es lo único que se enciende al escuchar, y eso es
 * exactamente lo que hace este muñeco. Está dibujada con tokens —`fill-tube`,
 * `stroke-brass`— así que cambiar el tema la repinta sola.
 *
 * **El estado ya no es un piloto en una esquina, es el personaje entero.** Un
 * punto de dos píxeles encendido no se veía; un filamento que se pone verde y
 * calienta el cristal se ve de reojo y desde lejos. Y el verde no es capricho:
 * es el mismo con el que el botón del micrófono dice que está abierto, así que
 * en toda la aplicación «encendido» tiene un solo color.
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
  /** Con el filamento encendido: está escuchando. */
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
      {/* La punta de la cúpula, detrás del cristal para que se funda con él. */}
      <circle cx="32" cy="5" r="2.4" className="fill-surface stroke-brass-dim" strokeWidth="2" />

      {/* El cristal: cúpula y dos paredes rectas hasta el zócalo. */}
      <path
        d="M16 45V16a16 12 0 0 1 32 0v29Z"
        className="fill-surface stroke-brass-dim"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/*
       * La brasa, en dos capas y solo escuchando.
       *
       * La de abajo tiñe **el cristal entero** —es el mismo trazado, así que su
       * borde es el del vidrio y no se ve como una pegatina pegada encima— y la
       * de arriba calienta la zona del filamento, que es de donde vendría el
       * calor. Late despacio: eso es lo que separa «encendido» de «dibujado
       * encendido».
       */}
      {atento && (
        <>
          <path d="M16 45V16a16 12 0 0 1 32 0v29Z" className="fill-tube" opacity="0.16" />
          <ellipse cx="32" cy="39" rx="12" ry="6.5" className="fill-tube animate-brasa" />
        </>
      )}

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
        <path d="M22 15.5c1.7-1.4 4.3-1.4 6 0" />
        <path d="M36 15.5c1.7-1.4 4.3-1.4 6 0" />
      </g>

      {/* Los ojos, con su brillo */}
      <g className="animate-parpadeo" style={{ transformOrigin: 'center 21.5px' }}>
        <circle cx="25" cy="21.5" r="3.8" className="fill-text" />
        <circle cx="39" cy="21.5" r="3.8" className="fill-text" />
        <circle cx="26.3" cy="20.2" r="1.3" className="fill-surface" />
        <circle cx="40.3" cy="20.2" r="1.3" className="fill-surface" />
      </g>

      {/*
       * La boca, a diez unidades de los ojos.
       *
       * Estuvo a cinco, pegada debajo, y a tamaño real no leía como una boca:
       * leía como un pico. La cara necesita el hueco de la mejilla igual que
       * necesita los ojos.
       *
       * Y abierta es un **hueco con reborde**, no una mancha de latón: rellena,
       * en mitad del cristal, volvía a leerse como un pico.
       */}
      {hablando ? (
        <ellipse
          cx="32"
          cy="31.5"
          rx="4.6"
          ry="3.2"
          className="fill-background stroke-brass animate-hablar"
          strokeWidth="2.5"
          style={{ transformOrigin: 'center 31.5px' }}
        />
      ) : (
        <path
          d="M26.5 30.5c2.2 2.4 8.8 2.4 11 0"
          fill="none"
          className="stroke-brass"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {/*
       * El filamento, en zigzag y no en dos horquillas.
       *
       * Con dos ganchos debajo de la boca se leía «UU», o unos dientes: se metía
       * en la cara en vez de estar dentro del aparato. Un alambre plegado es lo
       * que hay de verdad ahí dentro, y además no se parece a ninguna letra.
       */}
      <path
        d="M23 41l3-4 3 4 3-4 3 4 3-4 3 4"
        className={atento ? 'stroke-tube-bright' : 'stroke-text-muted'}
        strokeWidth="2"
        fill="none"
        // Apagado se ve poco, que es lo suyo, pero se ve: con `border` sobre el
        // tema claro desaparecia del todo y el cristal quedaba vacio.
        opacity={atento ? 1 : 0.45}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke 300ms' }}
      />

      {/* El zócalo, un punto más ancho que el cristal, y sus tres patillas. */}
      <rect
        x="13"
        y="44"
        width="38"
        height="10"
        rx="2.5"
        className="fill-surface-raised stroke-brass-dim"
        strokeWidth="2"
      />
      <path d="M15 49h34" className="stroke-brass-dim" strokeWidth="1.5" opacity="0.6" />
      <g className="stroke-brass-dim" strokeWidth="2.5" strokeLinecap="round">
        <path d="M23 54v4M32 54v5M41 54v4" />
      </g>
    </svg>
  );
}
