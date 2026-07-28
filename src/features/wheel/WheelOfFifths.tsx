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
const INNER_RADIUS = 66;
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
 * Gira como una rueda de cartón: las etiquetas van con ella. Cada una está
 * rotada su propio ángulo, así que la que queda arriba se lee derecha y las
 * demás quedan inclinadas, igual que en el aparato de verdad.
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
  }, [tonic, mode]);

  const activePosition = tonic !== null && mode !== null ? keyPosition(tonic, mode) : null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[300px] min-w-[240px]"
      role="img"
      aria-label={
        tonic === null || mode === null
          ? 'Rueda de quintas. Todavía no hay tonalidad detectada.'
          : `Rueda de quintas con ${noteName(tonic, accidentalForKey(tonic, mode))} ${
              mode === 'major' ? 'mayor' : 'menor'
            } arriba y ${mode === 'minor' ? 'las menores' : 'las mayores'} en el anillo de fuera.`
      }
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RING_RADIUS + 22}
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

      {/* Marca fija de las doce en punto: es la que señala la tonalidad. */}
      <path d={`M ${CENTER} 6 l 7 12 l -14 0 Z`} className="fill-brass-bright" aria-hidden="true" />

      <g ref={ringRef}>
        {/* Los dos anillos se dibujan al mismo radio; el de dentro se encoge.
            Así intercambiarlos es animar una escala, y el texto encoge con
            ellos, que es justo el énfasis que se busca. */}
        <g ref={majorsRef}>
          {CIRCLE_OF_FIFTHS.map((major, position) => (
            <KeyLabel
              key={major}
              point={pointAt(position, RING_RADIUS)}
              tilt={positionAngle(position)}
              label={noteName(major, accidentalForKey(major, 'major'))}
              name={keyName(major, 'major')}
              active={position === activePosition && mode === 'major'}
              onPick={onPick === undefined ? undefined : () => onPick(major, 'major')}
            />
          ))}
        </g>

        <g ref={minorsRef}>
          {CIRCLE_OF_FIFTHS.map((major, position) => {
            const minor = relativeMinor(major);
            return (
              <KeyLabel
                key={minor}
                point={pointAt(position, RING_RADIUS)}
                tilt={positionAngle(position)}
                label={`${noteName(minor, accidentalForKey(minor, 'minor'))}m`}
                name={keyName(minor, 'minor')}
                active={position === activePosition && mode === 'minor'}
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
  readonly tilt: number;
  readonly label: string;
  /** Nombre completo, para quien no ve la rueda. */
  readonly name: string;
  readonly active: boolean;
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
 */
function KeyLabel({ point, tilt, label, name, active, onPick }: KeyLabelProps) {
  const size = 13;
  const color = active ? 'fill-brass-bright' : 'fill-text-muted';

  if (onPick === undefined) {
    return (
      <text
        x={point.x}
        y={point.y}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${tilt} ${point.x} ${point.y})`}
        className={`font-mono ${color}`}
        style={{ fontSize: size }}
      >
        {label}
      </text>
    );
  }

  const box = 42;

  return (
    <foreignObject
      x={point.x - box / 2}
      y={point.y - box / 2}
      width={box}
      height={box}
      transform={`rotate(${tilt} ${point.x} ${point.y})`}
    >
      <button
        type="button"
        onClick={onPick}
        aria-pressed={active}
        title={name}
        className={`flex h-full w-full cursor-pointer items-center justify-center rounded-full font-mono transition-colors ${
          active ? 'text-brass-bright' : 'text-text-muted hover:text-text'
        }`}
        style={{ fontSize: size }}
      >
        <span aria-hidden="true">{label}</span>
        <span className="sr-only">{name}</span>
      </button>
    </foreignObject>
  );
}
