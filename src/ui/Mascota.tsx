import { CAPAS_MASCOTA, LADO_MASCOTA, type ColorMascota, type Trazo } from './mascota-pixeles';

/**
 * El muñeco: una válvula encendida, dibujada píxel a píxel.
 *
 * **Lo que se conserva es la válvula.** Fue un amplificador entero con cara, y a
 * tamaño real no se reconocía: la rejilla eran cinco puntos debajo de la boca
 * —que leen como botones, no como tela— y la cara ocupaba el chasis entero, así
 * que no quedaba sitio para lo único que lo habría identificado. Salía una
 * tostadora con ojos ([adr/0025](../../docs/adr/0025-la-mascota-es-una-valvula.md)).
 * La válvula resuelve las dos cosas: es el objeto más reconocible de este mundo,
 * su silueta —cúpula, zócalo y patillas— no depende de ningún detalle interior, y
 * es lo único que se enciende al escuchar, que es exactamente lo que hace este
 * muñeco. No la sostiene la paleta, que ya no es la de un amplificador
 * ([adr/0027](../../docs/adr/0027-grafito-y-ambar.md)).
 *
 * **Lo que cambia es el trazo: ahora es de píxel**, en una rejilla de 32×32 y a
 * 64 px por defecto, dos píxeles de pantalla por cada uno del dibujo
 * ([adr/0068](../../docs/adr/0068-la-mascota-es-de-pixel.md)). El vectorial
 * eran trazos de dos unidades en un lienzo de 64 pintado a 56 px: 1,75 píxeles de
 * pantalla, que el navegador reparte entre dos y deja en un borde lavado. Y era
 * plano, un relleno y un contorno por pieza. En píxel cada punto cae en uno de
 * pantalla, la luz viene de un solo lado —reflejo a la izquierda, sombra a la
 * derecha— y cada material tiene su rampa, así que tiene volumen sin un degradado.
 *
 * Se pinta como SVG y no como imagen: un `<path>` por color y capa, hecho de
 * rectángulos, con `crispEdges` para que el navegador no suavice los bordes.
 * Nítido a cualquier múltiplo y sin nada que descargar. **Los trazos no se tocan
 * aquí**: los escribe `arte/mascota/build.py` en `mascota-pixeles.ts`, y el color
 * de cada uno es una variable `--mascota-*` de globals.css, que cambia con el tema.
 *
 * **El estado es el personaje entero, no un piloto en una esquina.** Escuchando,
 * el filamento se pone blanco de calor, el cristal se tiñe de verde y un cerco
 * late alrededor; el verde es el mismo con el que el botón del micrófono dice que
 * está abierto, así que en toda la aplicación «encendido» tiene un solo color.
 * Hablando abre la boca —dos bocas que se turnan— y levanta las cejas; callado
 * mira de frente con media sonrisa, y parpadea cada pocos segundos.
 *
 * Todo eso son **capas que se encienden y se apagan**, nunca un dibujo que se
 * deforma: un píxel escalado deja de ser un píxel. Las animaciones son de
 * globals.css (`mascota-*`) y con movimiento reducido no corren; queda el gesto
 * quieto.
 *
 * Vive en `ui/` y no dentro de aprender porque lo usan dos sitios que no se
 * conocen: el profesor que asoma en las unidades y la bienvenida de la pantalla
 * de registro. Un feature no importa de otro, y dibujar el muñeco dos veces
 * acabaría con dos muñecos distintos.
 */
export function Mascota({
  hablando = false,
  atento = false,
  decorativa = false,
  className = 'size-16',
}: {
  /** Con la boca abierta y las cejas levantadas. */
  readonly hablando?: boolean;
  /** Con el filamento encendido: está escuchando. */
  readonly atento?: boolean;
  /**
   * Que vaya **junto a un nombre que ya lo dice**, como la marca de la barra de
   * arriba: ahí el enlace se llama «Caos ordenado», y con el muñeco como imagen se
   * leería «El profesor Caos ordenado». Decorativa, el lector se lo salta.
   */
  readonly decorativa?: boolean;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${LADO_MASCOTA} ${LADO_MASCOTA}`}
      shapeRendering="crispEdges"
      // La sombra es de la sala (`.sombra-pixel`), no la de Tailwind: era el
      // único relieve con un negro de fuera de la paleta.
      className={`sombra-pixel ${className}`}
      {...(decorativa
        ? { 'aria-hidden': true, focusable: false }
        : { role: 'img', 'aria-label': 'El profesor' })}
    >
      {/* El vidrio liso es aparte porque es lo que cambia de color al escuchar. */}
      <Capa trazos={CAPAS_MASCOTA.vidrio} tono={atento ? 'cristal-encendido' : undefined} />
      <Capa trazos={CAPAS_MASCOTA.cuerpo} />

      {atento && (
        <>
          <Capa trazos={CAPAS_MASCOTA.haloLejos} className="mascota-brasa" />
          <Capa trazos={CAPAS_MASCOTA.halo} />
        </>
      )}
      <Capa trazos={atento ? CAPAS_MASCOTA.filamentoEncendido : CAPAS_MASCOTA.filamentoApagado} />

      <Capa trazos={hablando ? CAPAS_MASCOTA.cejasArriba : CAPAS_MASCOTA.cejas} />
      <Capa trazos={CAPAS_MASCOTA.ojosAbiertos} className="mascota-ojos-abiertos" />
      <Capa trazos={CAPAS_MASCOTA.ojosCerrados} className="mascota-ojos-cerrados" />

      {hablando ? (
        <>
          <Capa trazos={CAPAS_MASCOTA.bocaAbierta} className="mascota-boca-abierta" />
          <Capa trazos={CAPAS_MASCOTA.bocaMedia} className="mascota-boca-entornada" />
        </>
      ) : (
        <Capa trazos={CAPAS_MASCOTA.bocaCallada} />
      )}
    </svg>
  );
}

/**
 * Una capa del dibujo: un trazo por color.
 *
 * `tono` pinta la capa entera de otro color, y solo lo pide el vidrio. Se pide así
 * y no con otra capa igual de otro color porque serían los mismos rectángulos dos
 * veces en el módulo.
 */
function Capa({
  trazos,
  tono,
  className,
}: {
  readonly trazos: readonly Trazo[];
  readonly tono?: ColorMascota;
  readonly className?: string;
}) {
  return (
    <g className={className}>
      {trazos.map(({ color, d }) => (
        <path key={color} d={d} style={{ fill: `var(--mascota-${tono ?? color})` }} />
      ))}
    </g>
  );
}
