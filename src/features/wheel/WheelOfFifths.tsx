'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

import {
  accidentalForKey,
  CIRCLE_OF_FIFTHS,
  keyPosition,
  positionAngle,
  relativeMinor,
  rotationForKey,
  shortestRotation,
  spanishNoteName,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import { motionSeconds } from '@ui/motion';
import { durations } from '@ui/tokens';

const SIZE = 260;
const CENTER = SIZE / 2;
const MAJOR_RADIUS = 104;
const MINOR_RADIUS = 66;

export interface WheelOfFifthsProps {
  readonly tonic: PitchClass | null;
  readonly mode: KeyMode | null;
}

/** Coordenadas de una posición de la rueda, medidas desde arriba. */
function pointAt(position: number, radius: number): { x: number; y: number } {
  const radians = ((positionAngle(position) - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
}

/**
 * Rueda de quintas que gira hasta poner arriba la tonalidad que suena.
 *
 * Gira como una rueda de cartón: las etiquetas van con ella. Cada una está
 * rotada su propio ángulo, así que la que queda arriba se lee derecha y las
 * demás quedan inclinadas, igual que en el aparato de verdad.
 */
export function WheelOfFifths({ tonic, mode }: WheelOfFifthsProps) {
  const ringRef = useRef<SVGGElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const ring = ringRef.current;
    if (ring === null || tonic === null || mode === null) {
      return;
    }

    // Girar por el camino corto: de Fa a Do son treinta grados hacia atrás, no
    // trescientos treinta hacia delante.
    const target = shortestRotation(rotationRef.current, rotationForKey(tonic, mode));
    rotationRef.current = target;

    gsap.to(ring, {
      rotation: target,
      svgOrigin: `${CENTER} ${CENTER}`,
      // GSAP escribe el transform a mano, así que la regla CSS de
      // prefers-reduced-motion no le afecta: hay que preguntarlo aquí.
      duration: motionSeconds(durations.wheel),
      ease: 'power3.out',
    });
  }, [tonic, mode]);

  const activePosition = tonic !== null && mode !== null ? keyPosition(tonic, mode) : null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[260px]"
      role="img"
      aria-label={
        tonic === null || mode === null
          ? 'Rueda de quintas. Todavía no hay tonalidad detectada.'
          : `Rueda de quintas con ${spanishNoteName(tonic, accidentalForKey(tonic, mode))} ${
              mode === 'major' ? 'mayor' : 'menor'
            } arriba.`
      }
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={MAJOR_RADIUS + 22}
        className="fill-surface stroke-border"
        strokeWidth={1}
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={MINOR_RADIUS + 20}
        className="fill-background stroke-border"
        strokeWidth={1}
      />

      {/* Marca fija de las doce en punto: es la que señala la tonalidad. */}
      <path d={`M ${CENTER} 6 l 7 12 l -14 0 Z`} className="fill-brass-bright" aria-hidden="true" />

      <g ref={ringRef}>
        {CIRCLE_OF_FIFTHS.map((major, position) => {
          const majorPoint = pointAt(position, MAJOR_RADIUS);
          const minorPoint = pointAt(position, MINOR_RADIUS);
          const minor = relativeMinor(major);
          const active = position === activePosition;
          const tilt = positionAngle(position);

          return (
            <g key={major}>
              <text
                x={majorPoint.x}
                y={majorPoint.y}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${tilt} ${majorPoint.x} ${majorPoint.y})`}
                className={`font-mono text-[13px] ${
                  active && mode === 'major' ? 'fill-brass-bright' : 'fill-text-muted'
                }`}
              >
                {spanishNoteName(major, accidentalForKey(major, 'major'))}
              </text>
              <text
                x={minorPoint.x}
                y={minorPoint.y}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${tilt} ${minorPoint.x} ${minorPoint.y})`}
                className={`font-mono text-[11px] ${
                  active && mode === 'minor' ? 'fill-brass-bright' : 'fill-text-muted opacity-70'
                }`}
              >
                {spanishNoteName(minor, accidentalForKey(minor, 'minor'))}m
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
