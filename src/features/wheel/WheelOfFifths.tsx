'use client';

import { gsap } from 'gsap';
import { useRef } from 'react';

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
import { motionSeconds } from '@ui/motion';
import { useIsomorphicLayoutEffect } from '@ui/use-isomorphic-layout-effect';
import { durations } from '@ui/tokens';

const SIZE = 260;
const CENTER = SIZE / 2;
/** Radio del anillo de fuera. Los dos se dibujan aquí y uno se encoge. */
const RING_RADIUS = 104;
/**
 * Y el de dentro, que además decide **cuánto encoge el anillo pequeño**.
 *
 * Subió de 66 a 72 por una razón de dedo y no de dibujo: la escala sale de
 * dividir estos dos, así que con 66 las tonalidades del anillo interior se
 * quedaban en veintinueve píxeles de lado en pantalla. Esta aplicación pide
 * cuarenta y cuatro en todo lo que se pulsa, y esas doce casillas eran de lo
 * poco que no pasaba por `ui/Button` ni por `ui/Chip`, así que nadie las medía.
 * Con 72 y la rueda un poco más ancha, salen por encima de cuarenta.
 */
const INNER_RADIUS = 72;
const INNER_SCALE = INNER_RADIUS / RING_RADIUS;

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
 * ya es el bueno y GSAP solo tiene que animar a partir de él.
 *
 * Se escribe a mano y no con `gsap.set` porque esto tiene que salir del render,
 * que es lo único que corre en el servidor.
 */
export function escalaDesdeElCentro(escala: number): string {
  return `translate(${round(CENTER * (1 - escala))} ${round(CENTER * (1 - escala))}) scale(${round(escala)})`;
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
  const ringRef = useRef<SVGGElement>(null);
  const majorsRef = useRef<SVGGElement>(null);
  const minorsRef = useRef<SVGGElement>(null);
  const rotationRef = useRef(0);
  const placedRef = useRef(false);

  // Antes del pintado, no después: los dos anillos se dibujan al mismo radio y
  // uno se encoge, así que si esto corriera tras pintar se verían solapados
  // durante un fotograma.
  useIsomorphicLayoutEffect(() => {
    const ring = ringRef.current;
    const majors = majorsRef.current;
    const minors = minorsRef.current;
    if (ring === null || majors === null || minors === null) {
      return;
    }

    const origin = `${CENTER} ${CENTER}`;
    // La primera vez se coloca de golpe: animar desde un estado que nadie ha
    // visto no es una animación, es un salto.
    const duration = placedRef.current ? motionSeconds(durations.wheel) : 0;
    placedRef.current = true;

    // El anillo del modo que manda pasa a fuera. Los dos son círculos de
    // quintas completos, así que ponerlos al revés sigue siendo correcto: lo
    // que no cambia son las posiciones, porque una menor y su relativa mayor
    // comparten armadura y por eso comparten sitio.
    const minorOutside = mode === 'minor';
    gsap.to(majors, {
      scale: minorOutside ? INNER_SCALE : 1,
      svgOrigin: origin,
      duration,
      ease: 'power3.out',
    });
    gsap.to(minors, {
      scale: minorOutside ? 1 : INNER_SCALE,
      svgOrigin: origin,
      duration,
      ease: 'power3.out',
    });

    if (tonic === null || mode === null) {
      return;
    }

    // Girar por el camino corto: de Fa a Do son treinta grados hacia atrás, no
    // trescientos treinta hacia delante.
    const target = shortestRotation(rotationRef.current, rotationForKey(tonic, mode));
    rotationRef.current = target;

    gsap.to(ring, {
      rotation: target,
      svgOrigin: origin,
      // GSAP escribe el transform a mano, así que la regla CSS de
      // prefers-reduced-motion no le afecta: hay que preguntarlo aquí.
      duration,
      ease: 'power3.out',
    });

    // Y el contragiro, a la vez y con la misma curva: si las dos rotaciones no
    // van acompasadas, las letras se ven bailar mientras la rueda pasa.
    //
    // El origen se pide por elemento —`transformOrigin` sobre la caja de cada
    // uno— y no con `svgOrigin`, que es una coordenada única del lienzo: las
    // doce etiquetas están en doce sitios distintos y girarían todas alrededor
    // del centro de la rueda, que es exactamente lo que se quiere deshacer.
    gsap.to(ring.querySelectorAll('[data-contragiro]'), {
      rotation: -target,
      transformOrigin: '50% 50%',
      duration,
      ease: 'power3.out',
    });
  }, [tonic, mode]);

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
      // Más ancha que antes —de 300 a 384— porque de aquí sale el tamaño real de
      // las veinticuatro casillas que se pulsan. Donde no quepa, `w-full` manda:
      // en la columna de componer se queda en los trescientos de siempre.
      className="h-auto w-full max-w-[min(24rem,100%)]"
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
        r={RING_RADIUS + 24}
        className="fill-surface stroke-border"
        strokeWidth={1}
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={INNER_RADIUS + 20}
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
          const hasta = pointAt(position - 0.5, RING_RADIUS + 24);
          return <line key={position} x1={desde.x} y1={desde.y} x2={hasta.x} y2={hasta.y} />;
        })}
      </g>

      {/* La marca fija de las doce en punto: es la que señala la tonalidad.

          Lleva su halo porque es lo único que no gira, y sobre el aro tenía el
          mismo peso visual que un radio cualquiera. */}
      <g aria-hidden="true">
        <circle cx={CENTER} cy={14} r={13} className="fill-brass-bright" opacity={0.14} />
        <path d={`M ${CENTER} 7 l 7 12 l -14 0 Z`} className="fill-brass-bright" />
      </g>

      <g ref={ringRef}>
        {/* Los dos anillos se dibujan al mismo radio; el de dentro se encoge.
            Así intercambiarlos es animar una escala, y el texto encoge con
            ellos, que es justo el énfasis que se busca. */}
        <g ref={majorsRef} transform={escalaDesdeElCentro(mode === 'minor' ? INNER_SCALE : 1)}>
          {CIRCLE_OF_FIFTHS.map((major, position) => (
            <KeyLabel
              key={major}
              point={pointAt(position, RING_RADIUS)}
              label={noteName(major, accidentalForKey(major, 'major'))}
              name={keyName(major, 'major')}
              active={position === activePosition && mode === 'major'}
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

        <g ref={minorsRef} transform={escalaDesdeElCentro(mode === 'minor' ? 1 : INNER_SCALE)}>
          {CIRCLE_OF_FIFTHS.map((major, position) => {
            const minor = relativeMinor(major);
            return (
              <KeyLabel
                key={minor}
                point={pointAt(position, RING_RADIUS)}
                label={`${noteName(minor, accidentalForKey(minor, 'minor'))}m`}
                name={keyName(minor, 'minor')}
                active={position === activePosition && mode === 'minor'}
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
 * El grupo `data-contragiro` es lo que mantiene la letra de pie mientras la
 * rueda gira; lo mueve el efecto de arriba.
 */
function KeyLabel({ point, label, name, active, alcanzable = false, onPick }: KeyLabelProps) {
  /**
   * Cuarenta y seis unidades del lienzo, y salen de una cuenta.
   *
   * A lo ancho del anillo hay hueco de sobra —dos pi por ciento cuatro entre doce
   * son cincuenta y cuatro—, así que cuarenta y seis no se solapan con la casilla
   * de al lado. Y en un teléfono, con la rueda desplegada a lo ancho, eso son
   * sesenta y cinco píxeles de verdad en el anillo grande y cuarenta y cinco en
   * el pequeño: **los cuarenta y cuatro que pide el proyecto**, que es lo que
   * estas veinticuatro casillas llevaban sin cumplir porque no pasan por
   * `ui/Button` ni por `ui/Chip` y nadie las medía.
   *
   * En un escritorio, metida en la columna de componer, la rueda se queda en unos
   * trescientos y el anillo pequeño baja a treinta y seis. Se acepta: ahí se
   * apunta con un ratón, no con el pulgar, y dos anillos de doce con casillas de
   * cuarenta y cuatro pedirían una rueda de seiscientos píxeles que no cabe en
   * ninguna de las tres pantallas donde vive.
   */
  const box = 46;

  if (onPick === undefined) {
    return (
      <g data-contragiro>
        <circle
          cx={point.x}
          cy={point.y}
          r={16}
          className={active ? 'fill-brass' : 'fill-transparent'}
        />
        <text
          x={point.x}
          y={point.y}
          textAnchor="middle"
          dominantBaseline="central"
          className={`font-mono ${active ? 'fill-background font-bold' : 'fill-text-muted'}`}
          style={{ fontSize: 14 }}
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <g data-contragiro>
      <foreignObject x={point.x - box / 2} y={point.y - box / 2} width={box} height={box}>
        <button
          type="button"
          data-casilla
          tabIndex={alcanzable ? 0 : -1}
          onClick={onPick}
          aria-pressed={active}
          title={name}
          className={`flex h-full w-full cursor-pointer items-center justify-center rounded-full border font-mono text-sm transition-[background-color,border-color,color] duration-150 ${
            active
              ? 'border-brass bg-brass text-background font-bold'
              : 'text-text-muted hover:border-brass-dim hover:bg-surface-raised hover:text-brass-bright border-transparent'
          }`}
        >
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{name}</span>
        </button>
      </foreignObject>
    </g>
  );
}
