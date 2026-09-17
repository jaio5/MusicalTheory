import {
  DEFAULT_FRET_COUNT,
  fretboardPositions,
  INLAY_FRETS,
  STANDARD_TUNING,
} from '@core/instrument';
import {
  SCALES,
  scaleNotes,
  noteName,
  type Accidental,
  type PitchClass,
  type ScaleId,
} from '@core/music';

const NUT_X = 46;
const FRET_WIDTH = 54;
const STRING_GAP = 30;
const TOP = 34;
const HEIGHT = TOP + STRING_GAP * 5 + 46;
const WIDTH = NUT_X + FRET_WIDTH * DEFAULT_FRET_COUNT + 18;

export interface FretboardProps {
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  /** Cómo se escriben las notas en esta tonalidad. */
  readonly accidental?: Accidental;
  /** La nota que suena ahora, para encenderla en el mástil. */
  readonly soundingMidi: number | null;
  /**
   * Las notas del acorde que hay elegido, si hay alguno.
   *
   * Con esto el mástil deja de enseñar una escala plana: **las notas del acorde
   * se rellenan y las demás se quedan huecas**. Es el problema central de
   * improvisar —la escala entra toda, pero solo tres notas caen de pie sobre el
   * acorde que suena— y hasta ahora las quince se pintaban igual.
   *
   * Es la misma idea que usa Hookpad en su pentagrama: elegidos los acordes,
   * pinta de color las notas que encajan y deja las disonantes en blanco. Aquí
   * se dice con relleno y hueco, que es lo que este proyecto ya usa para
   * distinguir sin depender del color.
   */
  readonly chordNotes?: readonly PitchClass[] | undefined;
}

/**
 * Mástil de quince trastes con la escala marcada.
 *
 * Los trastes van igual de anchos, que no es lo que pasa en una guitarra real
 * —se estrechan hacia el puente— pero es lo que hace legible un diagrama.
 */
export function Fretboard({
  tonic,
  scaleId,
  soundingMidi,
  chordNotes,
  accidental = 'sharp',
}: FretboardProps) {
  const notes = scaleNotes(tonic, scaleId);
  const delAcorde = new Set(chordNotes ?? []);
  const hayAcorde = delAcorde.size > 0;
  const positions = fretboardPositions().filter((position) => notes.includes(position.pitchClass));
  const stringIndex = new Map(STANDARD_TUNING.map((string, index) => [string.number, index]));

  // El alto sale de la proporción del dibujo, así que no sobra ni falta sitio a
  // los lados; el tope es lo que impide que en un área ancha y baja el dibujo
  // pida más alto del que hay.
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      // **Se ajusta a su caja**, no a la ventana.
      //
      // El tope era `60vh`, y con el mástil en su propia área del banco de
      // trabajo eso deja de valer: el dibujo mide cuatro veces más de ancho que
      // de alto, así que en un área ancha y baja pedía trescientos y pico
      // píxeles dentro de doscientos cincuenta y la parte de abajo se salía sin
      // manera de alcanzarla. Con `max-h-full` y el `preserveAspectRatio` que ya
      // tenía, lo que hace es encogerse: **sigue viéndose entero**, que es la
      // promesa, y el alto lo decide quien arrastra el divisor.
      className="h-auto max-h-full w-full"
      role="img"
      aria-label={
        hayAcorde
          ? `Mástil de ${DEFAULT_FRET_COUNT} trastes con la escala ${SCALES[
              scaleId
            ].name.toLowerCase()} de ${noteName(tonic, accidental)}, con las notas del acorde elegido rellenas.`
          : `Mástil de ${DEFAULT_FRET_COUNT} trastes con la escala ${SCALES[
              scaleId
            ].name.toLowerCase()} de ${noteName(tonic, accidental)} marcada.`
      }
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
        // Con acorde elegido manda el acorde, no la tonalidad: la tónica de la
        // canción es una nota más si no está en el acorde que suena ahora.
        const cae = hayAcorde ? delAcorde.has(position.pitchClass) : isTonic;

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
              className={cae ? 'fill-brass-bright' : 'fill-surface-raised stroke-brass-dim'}
              strokeWidth={cae ? 0 : 1.5}
            />
            {/* La fundamental del acorde lleva además un aro: de las tres que
                caen de pie, es la que dice cuál es el acorde. */}
            {hayAcorde && position.pitchClass === chordNotes?.[0] && (
              <circle
                cx={x}
                cy={y}
                r={12}
                className="stroke-brass-bright fill-none"
                strokeWidth={1.5}
              />
            )}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`font-mono text-[9px] ${cae ? 'fill-background' : 'fill-text-muted'}`}
            >
              {noteName(position.pitchClass, accidental)}
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
