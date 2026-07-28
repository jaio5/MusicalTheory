import {
  DEFAULT_FRET_COUNT,
  fretboardPositions,
  INLAY_FRETS,
  STANDARD_TUNING,
} from '@core/instrument';
import { SCALES, scaleNotes, spanishNoteName, type PitchClass, type ScaleId } from '@core/music';

const NUT_X = 46;
const FRET_WIDTH = 54;
const STRING_GAP = 30;
const TOP = 34;
const HEIGHT = TOP + STRING_GAP * 5 + 46;
const WIDTH = NUT_X + FRET_WIDTH * DEFAULT_FRET_COUNT + 18;

export interface FretboardProps {
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  /** La nota que suena ahora, para encenderla en el mástil. */
  readonly soundingMidi: number | null;
}

/**
 * Mástil de quince trastes con la escala marcada.
 *
 * Los trastes van igual de anchos, que no es lo que pasa en una guitarra real
 * —se estrechan hacia el puente— pero es lo que hace legible un diagrama.
 */
export function Fretboard({ tonic, scaleId, soundingMidi }: FretboardProps) {
  const notes = scaleNotes(tonic, scaleId);
  const positions = fretboardPositions().filter((position) => notes.includes(position.pitchClass));
  const stringIndex = new Map(STANDARD_TUNING.map((string, index) => [string.number, index]));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Mástil de ${DEFAULT_FRET_COUNT} trastes con la escala ${SCALES[
        scaleId
      ].name.toLowerCase()} de ${spanishNoteName(tonic)} marcada.`}
    >
      {INLAY_FRETS.map((fret) => (
        <rect
          key={fret}
          x={NUT_X + FRET_WIDTH * (fret - 1)}
          y={TOP - 12}
          width={FRET_WIDTH}
          height={STRING_GAP * 5 + 24}
          className="fill-surface-raised"
          opacity={fret === 12 ? 0.9 : 0.5}
        />
      ))}

      {/* Cejuela: más gruesa que los trastes, como en la guitarra. */}
      <line
        x1={NUT_X}
        y1={TOP - 10}
        x2={NUT_X}
        y2={TOP + STRING_GAP * 5 + 10}
        className="stroke-brass"
        strokeWidth={5}
      />

      {Array.from({ length: DEFAULT_FRET_COUNT }, (_, index) => index + 1).map((fret) => (
        <line
          key={fret}
          x1={NUT_X + FRET_WIDTH * fret}
          y1={TOP - 10}
          x2={NUT_X + FRET_WIDTH * fret}
          y2={TOP + STRING_GAP * 5 + 10}
          className="stroke-border"
          strokeWidth={2}
        />
      ))}

      {STANDARD_TUNING.map((string, index) => (
        <g key={string.number}>
          <line
            x1={NUT_X}
            y1={TOP + STRING_GAP * index}
            x2={WIDTH - 18}
            y2={TOP + STRING_GAP * index}
            className="stroke-border"
            strokeWidth={index > 3 ? 2 : 1}
          />
          <text
            x={NUT_X - 14}
            y={TOP + STRING_GAP * index}
            textAnchor="end"
            dominantBaseline="central"
            className="fill-text-muted font-mono text-[11px]"
          >
            {string.number}
          </text>
        </g>
      ))}

      {positions.map((position) => {
        const index = stringIndex.get(position.string.number) ?? 0;
        const x = position.fret === 0 ? NUT_X - 30 : NUT_X + FRET_WIDTH * (position.fret - 0.5);
        const y = TOP + STRING_GAP * index;
        const isTonic = position.pitchClass === tonic;
        const sounding = soundingMidi !== null && position.midi === soundingMidi;

        return (
          <g key={`${position.string.number}-${position.fret}`}>
            {sounding && (
              <circle
                cx={x}
                cy={y}
                r={13}
                className="stroke-tube-bright fill-none"
                strokeWidth={2}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={9}
              className={isTonic ? 'fill-brass-bright' : 'fill-surface-raised stroke-brass-dim'}
              strokeWidth={isTonic ? 0 : 1.5}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`font-mono text-[9px] ${isTonic ? 'fill-background' : 'fill-text-muted'}`}
            >
              {spanishNoteName(position.pitchClass)}
            </text>
          </g>
        );
      })}

      {INLAY_FRETS.map((fret) => (
        <text
          key={fret}
          x={NUT_X + FRET_WIDTH * (fret - 0.5)}
          y={TOP + STRING_GAP * 5 + 30}
          textAnchor="middle"
          className="fill-text-muted font-mono text-[11px]"
        >
          {fret}
        </text>
      ))}
    </svg>
  );
}
