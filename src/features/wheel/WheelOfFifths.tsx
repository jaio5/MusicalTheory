'use client';

import { useState } from 'react';

import {
  accidentalForKey,
  CIRCLE_OF_FIFTHS,
  keyPosition,
  positionAngle,
  relativeMinor,
  rotationForKey,
  shortestRotation,
  keyName,
  noteName,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import { durations } from '@ui/tokens';

const SIZE = 260;
const CENTER = SIZE / 2;

/**
 * **La diana de cada tonalidad, en unidades del lienzo: treinta y seis**, la misma
 * en los dos anillos. Y de ella salen los dos radios, no al revés.
 *
 * Los radios eran 104 y 72, puestos a ojo, y las casillas salían de ellos: en el
 * anillo pequeño, 31 unidades, que en un teléfono eran **34 píxeles** en la
 * portada y 32 en el panel de componer —el proyecto pide 44 en todo lo que se
 * pulsa—. Y peor que pequeñas, **pisadas**: el borde de dentro de cada mayor caía
 * siete unidades encima de su relativa menor, así que pulsar la parte baja de la
 * «C» elegía La menor. Lo midió `elementFromPoint`, no se veía.
 *
 * Al revés sale una cuenta cerrada. Doce dianas alrededor de un círculo solo
 * caben sin tocarse si el círculo es bastante grande —la cuerda entre dos
 * vecinas, `2·r·sen 15°`, tiene que ser la diana más la holgura—, y eso da el
 * radio de dentro; el de fuera es ese más una diana y otra holgura, y la diana de
 * fuera acaba justo en el borde del lienzo. **Treinta y seis es el máximo que
 * cabe**: con dos anillos de doce que comparten ángulo, una diana de 44 píxeles
 * pide una rueda de 318, y por eso un teléfono de 390 llega y uno de 320 no
 * (`docs/ESTILO.md`, los 44 px dentro de un SVG).
 */
export const DIANA = 36;
/** Lo que queda entre dos dianas vecinas, de lado y de un anillo a otro. */
export const HOLGURA = 2;
/** El anillo de dentro: el más pequeño en el que doce dianas no se tocan. */
export const INNER_RADIUS = Math.ceil((DIANA + HOLGURA) / (2 * Math.sin(Math.PI / 12)));
/** Y el de fuera, una diana y una holgura más allá; su diana acaba en el borde. */
export const RING_RADIUS = INNER_RADIUS + DIANA + HOLGURA;
const INNER_SCALE = INNER_RADIUS / RING_RADIUS;

/**
 * **Lo que se ve es más pequeño que lo que se pulsa**, y en el anillo de dentro
 * bastante más.
 *
 * Los dos anillos se dibujan al mismo radio y el de dentro se encoge, así que una
 * casilla que encogiera con él se quedaría en dos tercios de la diana. Por eso se
 * separan: la diana —el `<button>`— se agranda en el de dentro lo que el anillo le
 * quita, y mide lo mismo en pantalla en los dos; el disco que se ve sí encoge, que
 * es lo que dice qué anillo manda. Fuera, el disco deja un margen dentro de la
 * diana para que el aro del foco no caiga encima de su borde, que con la casilla
 * rellena de latón no se distinguiría.
 */
const DISCO_FUERA = 32;
const DISCO_DENTRO = 40;

/**
 * El cuerpo de letra de las casillas, según en qué anillo estén.
 *
 * **El anillo pequeño es el grande encogido**, y la letra encoge con él: a 14 px
 * salía a diez en pantalla, por debajo de los doce que pide `docs/ESTILO.md`. Se
 * le da de más lo que el anillo le quita —14 entre 0,69 son 20; con 18 basta,
 * porque la rueda nunca se pinta a menos de su tamaño de lienzo— y así queda en
 * trece. Con el anillo de dentro más pequeño que antes —dos tercios del de fuera
 * y no siete décimas— 18 se quedaba en 11,9 y sube a 19. Cambia con el modo porque los anillos se turnan el sitio, y el cambio
 * va con la misma transición que la escala para que no dé un salto.
 */
const LETRA_FUERA = 14;
const LETRA_DENTRO = 19;

/**
 * El movimiento de la rueda, en CSS.
 *
 * Lo hacía GSAP: 29,6 KB comprimidos en la portada, en componer y en el profesor
 * para cuatro interpolaciones de un transform ([adr/0057](../../../docs/adr/0057-la-rueda-gira-sin-gsap.md)).
 * Una transición hace lo mismo y además **obedece sola a `prefers-reduced-motion`**:
 * la regla global de `globals.css` la deja en 0,01 ms, cosa que con GSAP había que
 * preguntar a mano porque escribía el transform él mismo. La curva es la
 * `power3.out` de GSAP, que es una cuártica de salida.
 */
const CURVA = `${durations.wheel}ms cubic-bezier(0.25, 1, 0.5, 1)`;
const TRANSICION = `transform ${CURVA}, font-size ${CURVA}`;

/** El centro del lienzo como origen de un transform CSS, que en SVG va en unidades del lienzo. */
const ORIGEN_CENTRO = `${CENTER}px ${CENTER}px`;

export interface WheelOfFifthsProps {
  readonly tonic: PitchClass | null;
  readonly mode: KeyMode | null;
  /** Si se da, cada tonalidad de la rueda se puede pulsar para fijarla. */
  readonly onPick?: (tonic: PitchClass, mode: KeyMode) => void;
}

/**
 * Coordenadas de una posición de la rueda, medidas desde arriba.
 *
 * Redondeadas a tres decimales a propósito. `Math.cos` puede devolver el último
 * bit distinto en Node y en el navegador, y eso basta para que el HTML del
 * servidor y el del cliente no coincidan: React avisa de que la hidratación ha
 * fallado por un `18.933358006418402` contra un `18.933358006418416`. Para
 * colocar una etiqueta sobran doce decimales.
 */
/**
 * La escala de un anillo, escrita ya en el marcado.
 *
 * Los dos anillos se dibujan al mismo radio y el de dentro se encoge, y eso lo
 * hacía **solo** el efecto de layout. En el servidor no hay efecto: el HTML que
 * llega salía con los veinticuatro nombres pisados unos encima de otros, y así
 * se veía hasta que bajaba el JavaScript. Poniéndola aquí, el primer fotograma
 * ya es el bueno, y la transición anima a partir de él.
 *
 * Es un transform **CSS** y no el atributo de SVG, que no se puede transicionar:
 * por eso lleva `px`, que dentro de un SVG son unidades del lienzo.
 */
export function escalaDesdeElCentro(escala: number): string {
  const desplazamiento = round(CENTER * (1 - escala));
  return `translate(${desplazamiento}px, ${desplazamiento}px) scale(${round(escala)})`;
}

export function pointAt(position: number, radius: number): { x: number; y: number } {
  const radians = ((positionAngle(position) - 90) * Math.PI) / 180;
  return {
    x: round(CENTER + radius * Math.cos(radians)),
    y: round(CENTER + radius * Math.sin(radians)),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Rueda de quintas que gira hasta poner arriba la tonalidad que suena.
 *
 * **Gira la rueda, pero las letras se quedan de pie.**
 *
 * Giraban con ella, cada una rotada su propio ángulo, «igual que en el aparato
 * de verdad». En cartón eso funciona porque el aparato se coge y se tuerce; en
 * una pantalla que no se puede girar, once de las doce tonalidades quedaban
 * tumbadas o boca abajo a trece píxeles, y esto es **el control con el que
 * empieza todo lo demás**: sin tonalidad no hay acordes, ni escala, ni
 * preguntas, ni canción. Un mando que hay que descifrar letra a letra no es un
 * mando.
 *
 * Se resuelve con un contragiro: el anillo lleva la rotación que toca y dentro
 * de cada etiqueta hay un grupo que gira lo mismo del revés. El movimiento sigue
 * viéndose —la rueda pasa por delante y la tonalidad acaba arriba— y lo que no
 * se mueve es la letra.
 */
export function WheelOfFifths({ tonic, mode, onPick }: WheelOfFifthsProps) {
  const destino = tonic !== null && mode !== null ? rotationForKey(tonic, mode) : null;
  // El giro se acumula: girar por el camino corto depende de dónde se quedó la
  // rueda, no solo de a dónde va —de Fa a Do son treinta grados hacia atrás, no
  // trescientos treinta hacia delante—. Se ajusta durante el render, que es como
  // React pide derivar un estado de las props sin un efecto que pinte dos veces.
  const [giro, setGiro] = useState(destino === null ? 0 : shortestRotation(0, destino));
  const [destinoVisto, setDestinoVisto] = useState(destino);
  if (destino !== destinoVisto) {
    setDestinoVisto(destino);
    // Sin tonalidad la rueda se queda donde estaba: volver a Do sería un giro
    // que no dice nada.
    if (destino !== null) {
      setGiro(shortestRotation(giro, destino));
    }
  }

  // El anillo del modo que manda pasa a fuera. Los dos son círculos de quintas
  // completos, así que ponerlos al revés sigue siendo correcto: lo que no cambia
  // son las posiciones, porque una menor y su relativa mayor comparten armadura
  // y por eso comparten sitio.
  const minorOutside = mode === 'minor';

  const activePosition = tonic !== null && mode !== null ? keyPosition(tonic, mode) : null;
  const sePulsa = onPick !== undefined;

  /**
   * Moverse por la rueda con las flechas, y **una sola parada de tabulador**.
   *
   * Eran veinticuatro. Entrar en componer con el teclado y llegar a la lista de
   * acordes costaba pasar por las doce mayores y las doce menores, una a una: la
   * rueda no es una lista de veinticuatro enlaces, es **un mando**, y un mando se
   * tabula una vez y se recorre con las flechas. Es el mismo patrón que un grupo
   * de opciones, y es lo que espera cualquiera que llegue aquí sin ratón.
   *
   * Se apoya en el orden del documento: los doce de un anillo van seguidos, así
   * que moverse es sumar o restar uno dentro de su bloque de doce. Izquierda y
   * derecha giran; arriba y abajo cambian de anillo, que es lo que hacen los dos
   * anillos al mirarlos.
   */
  function conFlechas(evento: React.KeyboardEvent<SVGSVGElement>): void {
    const casillas = [
      ...evento.currentTarget.querySelectorAll<HTMLButtonElement>('[data-casilla]'),
    ];
    const desde = casillas.indexOf(document.activeElement as HTMLButtonElement);
    if (desde === -1) {
      return;
    }

    // Las veinticuatro van en el documento en dos bloques de doce —primero las
    // mayores y después las menores—, así que el anillo es la división entera y
    // la posición dentro del anillo, el resto.
    const DOCE = CIRCLE_OF_FIFTHS.length;
    const anillo = Math.floor(desde / DOCE);
    const sitio = desde % DOCE;

    let destino: number;
    switch (evento.key) {
      // Girar **da la vuelta dentro de su anillo**, no salta al otro. Con una
      // sola lista de veinticuatro, ir a la izquierda desde el Do de arriba te
      // dejaba en el Re menor del anillo pequeño: la rueda no se mueve así.
      case 'ArrowRight':
        destino = anillo * DOCE + ((sitio + 1) % DOCE);
        break;
      case 'ArrowLeft':
        destino = anillo * DOCE + ((sitio - 1 + DOCE) % DOCE);
        break;
      // Y cambiar de anillo se queda en el mismo sitio, que es lo que se ve: una
      // menor y su relativa mayor comparten armadura y por eso comparten
      // posición.
      case 'ArrowDown':
      case 'ArrowUp':
        destino = ((anillo + 1) % 2) * DOCE + sitio;
        break;
      default:
        return;
    }

    evento.preventDefault();
    casillas[destino]?.focus();
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      /*
        **Crece con su caja, y a partir de 24 rem solo si la caja es ancha.**

        Se quedaba en 384 px pasara lo que pasara, y en la portada de un monitor
        de 2560 eso era un posavasos en medio de una columna de 1300. El tope
        sale ahora de un porcentaje **de su caja** y no de la ventana: el 42 %,
        entre 24 y 34 rem. Hasta una caja de 914 px el porcentaje da menos de 24
        rem y manda el suelo, así que en todos los sitios estrechos donde vive
        —la barra de la unidad, el profesor, el panel y la columna de componer,
        que no pasa de 34 rem— sigue igual que antes; solo la portada la ve crecer.
        Donde no quepa ni eso, `w-full` manda.

        `overflow-visible` porque la diana de fuera acaba en el borde del lienzo,
        y sin él el aro del foco se cortaba por la mitad en las de arriba.
      */
      className="h-auto w-full max-w-[clamp(24rem,42%,34rem)] overflow-visible"
      onKeyDown={sePulsa ? conFlechas : undefined}
      /*
       * **Imagen solo cuando de verdad lo es.**
       *
       * Llevaba `role="img"` siempre, y con veinticuatro botones dentro eso es
       * decirle a un lector de pantalla que ahí no hay nada que tocar: los hijos
       * de un `img` son decoración por definición. En la portada sí es una
       * imagen —allí la rueda no se pulsa— y entonces el rótulo largo es justo lo
       * que hay que leer. Donde se elige tonalidad es un grupo de controles con
       * su nombre.
       */
      role={sePulsa ? 'group' : 'img'}
      /*
       * El nombre lleva **cómo se usa y cómo está**, en ese orden.
       *
       * Lo segundo ya estaba y hace falta: qué tonalidad ha quedado arriba y qué
       * anillo ha pasado a fuera son las dos cosas que la rueda dice girando, y
       * girar no se oye. Lo primero es nuevo y va delante porque, en un grupo,
       * lo que se anuncia al entrar tiene que decir qué se puede hacer: aquí se
       * elige, y se recorre con las flechas.
       */
      aria-label={`${sePulsa ? 'Rueda de quintas: elige la tonalidad, y muévete con las flechas. ' : ''}${
        tonic === null || mode === null
          ? 'Rueda de quintas. Todavía no hay tonalidad detectada.'
          : `Rueda de quintas con ${noteName(tonic, accidentalForKey(tonic, mode))} ${
              mode === 'major' ? 'mayor' : 'menor'
            } arriba y ${mode === 'minor' ? 'las menores' : 'las mayores'} en el anillo de fuera.`
      }`}
    >
      {/* El chasis del mando, en tres círculos.

          Era un disco liso con las letras encima: sobre un fondo casi del mismo
          color, no se veía dónde acababa la rueda ni que las tonalidades
          estuvieran repartidas en doce sitios. Ahora hay un aro de fuera que la
          recorta, la corona donde vive el anillo grande y un pozo en el centro,
          que es lo que hace que los dos anillos se lean como dos y no como una
          nube de letras a dos distancias. */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={CENTER - 0.5}
        className="fill-surface stroke-border"
        strokeWidth={1}
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={INNER_RADIUS + (DIANA + HOLGURA) / 2}
        className="fill-background stroke-border"
        strokeWidth={1}
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={INNER_RADIUS - 22}
        className="fill-surface stroke-border"
        strokeWidth={1}
      />

      {/* Los doce radios: sin ellos, doce letras sueltas en un círculo no dicen
          que sean doce casillas de un mando, y no se ve que la marca de arriba
          apunta a una. Van muy tenues —son la trama, no el dato—. */}
      <g className="stroke-border" strokeWidth={1} aria-hidden="true" opacity={0.7}>
        {CIRCLE_OF_FIFTHS.map((_, position) => {
          const desde = pointAt(position - 0.5, INNER_RADIUS - 22);
          const hasta = pointAt(position - 0.5, CENTER - 0.5);
          return <line key={position} x1={desde.x} y1={desde.y} x2={hasta.x} y2={hasta.y} />;
        })}
      </g>

      {/* La marca fija de las doce en punto: es la que señala la tonalidad.

          **Vive en el pozo del centro y apunta hacia arriba**, como la aguja de
          un reloj. Estaba encima del aro, con su halo, y ahí caía sobre la
          casilla de arriba: sin tonalidad tapaba media «C», que es justo la
          parada del tabulador. En el pozo no hay nada que tapar, y no gira. */}
      <path
        aria-hidden="true"
        d={`M ${CENTER} ${CENTER - INNER_RADIUS + 26} l 9 13 l -18 0 Z`}
        className="fill-brass-bright"
      />

      <g
        style={{
          transform: `rotate(${giro}deg)`,
          transformOrigin: ORIGEN_CENTRO,
          transition: TRANSICION,
        }}
      >
        {/* Los dos anillos se dibujan al mismo radio; el de dentro se encoge.
            Así intercambiarlos es animar una escala, y el texto encoge con
            ellos, que es justo el énfasis que se busca. */}
        <g
          style={{
            transform: escalaDesdeElCentro(minorOutside ? INNER_SCALE : 1),
            transition: TRANSICION,
          }}
        >
          {CIRCLE_OF_FIFTHS.map((major, position) => (
            <KeyLabel
              key={major}
              point={pointAt(position, RING_RADIUS)}
              label={noteName(major, accidentalForKey(major, 'major'))}
              name={keyName(major, 'major')}
              active={position === activePosition && mode === 'major'}
              giro={giro}
              dentro={minorOutside}
              // La parada del tabulador es una: la tonalidad puesta, y si no hay
              // ninguna, el Do de arriba. Las demás se alcanzan con las flechas.
              alcanzable={
                activePosition === null
                  ? position === 0
                  : position === activePosition && mode === 'major'
              }
              onPick={onPick === undefined ? undefined : () => onPick(major, 'major')}
            />
          ))}
        </g>

        <g
          style={{
            transform: escalaDesdeElCentro(minorOutside ? 1 : INNER_SCALE),
            transition: TRANSICION,
          }}
        >
          {CIRCLE_OF_FIFTHS.map((major, position) => {
            const minor = relativeMinor(major);
            return (
              <KeyLabel
                key={minor}
                point={pointAt(position, RING_RADIUS)}
                label={`${noteName(minor, accidentalForKey(minor, 'minor'))}m`}
                name={keyName(minor, 'minor')}
                active={position === activePosition && mode === 'minor'}
                giro={giro}
                dentro={!minorOutside}
                alcanzable={position === activePosition && mode === 'minor'}
                onPick={onPick === undefined ? undefined : () => onPick(minor, 'minor')}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}

interface KeyLabelProps {
  readonly point: { x: number; y: number };
  readonly label: string;
  /** Nombre completo, para quien no ve la rueda. */
  readonly name: string;
  readonly active: boolean;
  /** El giro de la rueda, que la etiqueta deshace para quedarse de pie. */
  readonly giro: number;
  /** Si su anillo es el de dentro, que encoge y le pide más cuerpo de letra. */
  readonly dentro: boolean;
  /**
   * Si es **la** parada del tabulador de toda la rueda.
   *
   * Una sola de las veinticuatro, que es lo que convierte esto en un mando en
   * vez de en una lista: se entra una vez y se recorre con las flechas. Las
   * demás siguen siendo botones de verdad, enfocables desde el teclado y desde
   * el ratón; lo que no hacen es pedir turno en el tabulador.
   */
  readonly alcanzable?: boolean;
  readonly onPick?: () => void;
}

/**
 * Una tonalidad de la rueda.
 *
 * Cuando se puede pulsar es un `<button>` de verdad dentro de un
 * `foreignObject`, no un `<g>` con `onClick`: así entra en el orden de
 * tabulación, responde a Intro y a espacio, y el lector de pantalla lo anuncia
 * como lo que es. Un `<g role="button">` obliga a reimplementar todo eso a
 * mano y siempre se queda algo por el camino.
 *
 * **Se ve que es un botón antes de pulsarlo.** Eran letras sueltas de trece
 * píxeles sobre el disco: nada decía que hubiera doce sitios donde pulsar, y la
 * pantalla más importante de la aplicación empezaba pidiendo «elige una
 * tonalidad» delante de algo que no parecía elegible. Ahora cada una tiene su
 * casilla redonda, que se enciende al pasar por encima y se rellena de latón
 * cuando es la que manda.
 *
 * El contragiro es lo que mantiene la letra de pie mientras la rueda gira: el
 * mismo ángulo del revés, con la misma transición —si las dos rotaciones no van
 * acompasadas, las letras se ven bailar—. Su origen es **el centro de la
 * etiqueta** y no el de la rueda: girar alrededor del centro de la rueda es
 * justo lo que se quiere deshacer.
 */
function KeyLabel({
  point,
  label,
  name,
  active,
  giro,
  dentro,
  alcanzable = false,
  onPick,
}: KeyLabelProps) {
  const contragiro = {
    transform: `rotate(${-giro}deg)`,
    transformOrigin: `${point.x}px ${point.y}px`,
    transition: TRANSICION,
  };
  const letra = { fontSize: dentro ? LETRA_DENTRO : LETRA_FUERA, transition: TRANSICION };

  /**
   * El disco que se ve, en unidades de su anillo. Encoge con el anillo de dentro,
   * y su tamaño acompaña a la escala con la misma transición.
   */
  const disco = dentro ? DISCO_DENTRO : DISCO_FUERA;
  /**
   * Y la diana, que no encoge: en el anillo de dentro se dibuja a escala menor,
   * así que se le da de más lo que la escala le quita y en pantalla mide
   * `DIANA` en los dos. Cambia de golpe al turnarse los anillos y no con la
   * transición; es invisible, y durante esos 650 ms la que pasa a dentro es más
   * grande de la cuenta, no más pequeña.
   */
  const box = dentro ? DIANA / INNER_SCALE : DIANA;

  if (onPick === undefined) {
    return (
      <g data-contragiro style={contragiro}>
        <circle
          cx={point.x}
          cy={point.y}
          r={disco / 2}
          className={active ? 'fill-brass' : 'fill-transparent'}
        />
        <text
          x={point.x}
          y={point.y}
          textAnchor="middle"
          dominantBaseline="central"
          className={`font-mono ${active ? 'fill-background font-bold' : 'fill-text-muted'}`}
          style={letra}
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <g data-contragiro style={contragiro}>
      {/*
        La caja no recibe el puntero; solo el botón redondo que lleva dentro.

        Un `foreignObject` es un cuadrado, y sus esquinas se comían los clics del
        vecino: en la parte de abajo de la «C» contestaba la caja de La menor, que
        no tiene nada pintado ahí. Con `pointer-events` apagado en la caja y
        encendido en el botón, lo que se pulsa es el círculo y nada más, porque el
        navegador respeta el `border-radius` al decidir qué hay bajo el dedo.
      */}
      <foreignObject
        x={point.x - box / 2}
        y={point.y - box / 2}
        width={box}
        height={box}
        className="pointer-events-none overflow-visible"
      >
        <button
          type="button"
          data-casilla
          tabIndex={alcanzable ? 0 : -1}
          onClick={onPick}
          aria-pressed={active}
          title={name}
          // La letra va aquí y la hereda el disco: es lo que acompaña a la rueda.
          style={{ fontSize: dentro ? LETRA_DENTRO : LETRA_FUERA, transition: TRANSICION }}
          // El aro del foco va **pegado a la diana** (`outline-offset-0`): con los
          // tres píxeles de siempre se metía en la diana de al lado, que está a dos.
          className="group/casilla text-text-muted pointer-events-auto flex h-full w-full cursor-pointer items-center justify-center rounded-full font-mono outline-offset-0"
        >
          {/* El disco, que es lo que se ve y lo que se enciende. La diana que lo
              rodea es transparente, pero pasar por encima de ella también lo
              enciende: el disco dice dónde se pulsa, la diana cuánto. El grupo
              lleva nombre porque la rueda vive dentro de desplegables que son
              `group` también: con el anónimo, pasar el ratón por la barra de la
              tonalidad encendía las veinticuatro a la vez. */}
          <span
            aria-hidden="true"
            style={{
              width: disco,
              height: disco,
              // Dos ritmos: el color responde al puntero en seguida y el tamaño
              // acompaña a la rueda.
              transition: `background-color 150ms, border-color 150ms, color 150ms, width ${CURVA}, height ${CURVA}`,
            }}
            className={`flex shrink-0 items-center justify-center rounded-full border ${
              active
                ? 'border-brass bg-brass text-background font-bold'
                : 'group-hover/casilla:border-brass-dim group-hover/casilla:bg-surface-raised group-hover/casilla:text-brass-bright border-transparent'
            }`}
          >
            {label}
          </span>
          <span className="sr-only">{name}</span>
        </button>
      </foreignObject>
    </g>
  );
}
