'use client';

import { useMemo, useState } from 'react';

import { chordVoicings } from '@core/instrument';
import {
  accidentalForKey,
  comoBloque,
  HARMONIC_ROLES,
  noteName,
  scaleNotes,
  scheduleProgression,
  suggestChords,
  suggestTransitions,
  type DegreeSymbol,
  type EspecieDeBloque,
  type HarmonicRole,
  type ParsedChord,
  type PitchClass,
} from '@core/music';
import { useAcordeElegido } from '@state/acorde-elegido';
import { useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, useSessionStore, type PathChord } from '@state/session-store';
import { useProgressionPlayer } from '@state/use-progression-player';
import type { ProgressionPlayer } from '@audio/progression-player';
import { ChordDiagram } from '@ui/ChordDiagram';
import { Chip } from '@ui/Chip';
import { IconoCerrar, IconoMastil, IconoParar, IconoSonar } from '@ui/icons';
import { Marca, type MarcaTono } from '@ui/Marca';
import { Vacio } from '@ui/Vacio';

import { ChordSearch } from './ChordSearch';

/**
 * La letra del papel que hace el acorde: T, S o D.
 *
 * En gris y sin color a propósito. El punto de al lado ya está usando el verde,
 * el ámbar y el rojo para otra cosa —si el acorde entra en la tonalidad o se
 * sale— y dos códigos de color en la misma fila no se leen, se adivinan.
 *
 * La letra sola no enseña nada a quien empieza, así que el nombre entero y lo
 * que significa van en el título, y el lector de pantalla lee el nombre, no la
 * inicial.
 */
function RoleBadge({ role }: { role: HarmonicRole }) {
  const info = HARMONIC_ROLES[role];
  return (
    <span
      title={`${info.name}. ${info.what} ${info.goes}`}
      className="border-border text-text-muted mt-0.5 shrink-0 rounded-sm border px-1 font-mono text-xs"
    >
      <span aria-hidden="true">{info.short}</span>
      <span className="sr-only">{info.name}</span>
    </span>
  );
}

function fromSearch(chord: ParsedChord): PathChord {
  return {
    symbol: chord.symbol,
    label: chord.shape.name,
    root: chord.root,
    notes: chord.notes,
    why: 'Lo has buscado tú.',
  };
}

/**
 * Entra si es seguro, color si trae una nota de fuera y fuera si trae más.
 *
 * Es la lectura rápida que hace falta mientras tocas: no da tiempo a leer el
 * porqué de cada acorde, pero sí a ver la marca del que vas a pisar.
 *
 * Devuelve un tono y no una clase porque **la marca también tiene forma**: el
 * verde y el rojo de este código son la pareja que no distingue la deficiencia
 * de color más común, así que el círculo, el anillo y el rombo dicen lo mismo
 * que los tres colores. Lo dibuja `ui/Marca`.
 */
function safetyTone(notes: readonly PitchClass[], inKey: ReadonlySet<PitchClass>): MarcaTono {
  const outside = notes.filter((note) => !inKey.has(note)).length;
  if (outside === 0) {
    return 'entra';
  }
  return outside === 1 ? 'color' : 'fuera';
}

/** Lo mínimo para dibujar un acorde: da igual si lo elegiste o si lo tocaste. */
export type ShowableChord = Pick<PathChord, 'symbol' | 'root' | 'notes'>;

/** Los intervalos del acorde respecto a su fundamental, para buscar formas. */
function relativeIntervals(chord: ShowableChord): number[] {
  return chord.notes.map((note) => (note - chord.root + 12) % 12).sort((a, b) => a - b);
}

/**
 * Todas las maneras de hacer un acorde a lo largo del mástil.
 *
 * Se enseñan a la vez y no de una en una: la gracia es ver que el mismo acorde
 * vive en cinco sitios distintos, y eso no se ve pasando páginas.
 */
export function VoicingList({ chord }: { chord: ShowableChord }) {
  const voicings = useMemo(
    () => chordVoicings(chord.root, relativeIntervals(chord), { limit: 6 }),
    [chord],
  );

  if (voicings.length === 0) {
    return (
      <p className="text-text-muted p-3 text-sm">
        No cabe en cuatro trastes con la fundamental al bajo. Prueba otra forma del acorde.
      </p>
    );
  }

  return (
    <ul aria-label={`Formas de hacer ${chord.symbol}`} className="flex flex-wrap gap-2 p-3">
      {voicings.map((voicing) => (
        // Cada forma en su tarjeta. Sueltas y pegadas por un hueco, seis
        // diagramas seguidos se leen como una sola rejilla larga y hay que
        // contar las cuerdas para saber dónde acaba uno y empieza el siguiente.
        <li
          key={voicing.frets.join('-')}
          className="border-border rounded-lg border px-1.5 pt-1 pb-1.5"
        >
          <ChordDiagram
            frets={voicing.frets}
            position={voicing.position}
            label={`${chord.symbol}, ${voicing.name.toLowerCase()}`}
          />
          <span className="text-text-muted mt-0.5 block text-center text-xs">{voicing.name}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * El camino: en qué acorde estás, de cuántas maneras se hace y a dónde puedes
 * ir. Son tres piezas sueltas porque la pantalla de componer las coloca en
 * sitios distintos.
 */

/**
 * En qué acorde estás, cómo has llegado y **cómo suena lo que llevas**.
 *
 * Lo último faltaba, y era lo que convertía esta pantalla en un catálogo: se
 * encadenaban C, F, G y Am leyendo por qué pega cada uno con el anterior, y no
 * había forma de oírlo sin coger la guitarra y tocarlo. La aplicación ya sabía
 * sonar progresiones —lo hacen el lienzo de montar, las salidas y las preguntas
 * de oído— y aquí no se le había pedido.
 */
/**
 * La tira de lo que estás probando, y el botón de oírla.
 *
 * **No es tu canción**, y por eso ya no se llama progresión: la canción vive en
 * el lienzo desde el [adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md),
 * y aquí queda lo que se prueba sin escribir —los acordes que no caben en un
 * bloque, como un `C5`... o lo que cabía antes de que un bloque supiera guardar
 * especies—. Llamarlo progresión era nombrar dos cosas igual en la misma
 * pantalla.
 */
export function CurrentChord({
  createPlayer,
}: {
  readonly createPlayer?: () => ProgressionPlayer;
}) {
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const bpm = useSessionStore((state) => state.bpm);
  const actions = useSessionStore((state) => state.actions);
  const current = path.at(-1) ?? null;
  const hayBloqueElegido = useAcordeElegido() !== null;

  const [sonando, setSonando] = useState(false);
  /** Por qué acorde va la reproducción, para encenderlo en la tira. */
  const [pasoSonando, setPasoSonando] = useState<number | null>(null);

  const { pedir, parar } = useProgressionPlayer(createPlayer);

  /**
   * Suena lo que llevas, o lo calla si ya sonaba.
   *
   * El mismo botón para las dos cosas: cuando algo está sonando, lo que se
   * quiere hacer es cortarlo, y un botón de parar aparte obliga a apuntar a otro
   * sitio. Es lo que ya hacen las salidas.
   *
   * Dos pulsos por acorde: es el reparto más corto en el que se oye el
   * movimiento de uno al siguiente, que es de lo que va esta pantalla, y no
   * obliga a esperar cuatro compases para oír una progresión de cuatro acordes.
   */
  async function escuchar(): Promise<void> {
    if (sonando) {
      parar();
      setSonando(false);
      setPasoSonando(null);
      return;
    }

    setSonando(true);
    setPasoSonando(null);
    await pedir().play(
      scheduleProgression(
        path.map((chord) => ({ root: chord.root, notes: chord.notes, beats: 2 })),
        bpm,
      ),
      // El reproductor ya dice por qué acorde va: se usa para encenderlo en la
      // tira. Estaba llegando y se tiraba, y mirar una progresión sonar sin ver
      // dónde va es la mitad de la gracia de poder oírla.
      (index) => {
        setPasoSonando(index);
        if (index === null) {
          setSonando(false);
        }
      },
    );
  }
  const accidental =
    activeKey === null ? 'sharp' : accidentalForKey(activeKey.tonic, activeKey.mode);

  if (activeKey === null) {
    return (
      <p className="text-text-muted flex h-full items-center justify-center p-6 text-center text-sm">
        Elige una tonalidad en la rueda y empezamos.
      </p>
    );
  }

  // Con un bloque elegido no hay nada que decir aquí: el camino está vacío, pero
  // el acorde que miras es el de tu canción y lo enseña el mástil de abajo.
  // Estuvo saliendo «Elige el primer acorde» justo encima de las formas del
  // acorde ya elegido, que es decirle a alguien que empiece lo que ya hizo.
  if (current === null && hayBloqueElegido) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {current === null ? (
        <Vacio icono={<IconoMastil />} titulo="Elige el primer acorde">
          Ponlo desde la lista que hay junto a la canción, ordenada por lo bien que entra en tu
          tonalidad. Al pulsar uno aquí sale cómo se hace, traste a traste.
        </Vacio>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-brass-bright text-4xl leading-none">
              {current.symbol}
            </span>
            <span className="text-text-muted font-mono text-xs">{current.label}</span>
            <span className="text-text-muted ml-auto font-mono text-xs">
              {current.notes.map((note) => noteName(note, accidental)).join(' · ')}
            </span>
          </div>
          <p className="text-text-muted text-sm">{current.why}</p>
        </>
      )}

      {path.length > 0 && (
        <div className="border-border flex items-center gap-1 border-t pt-2">
          {/* El botón de oírla, primero: es lo que se hace con una progresión
              terminada, y a la derecha se habría quedado detrás de una lista que
              se desplaza. */}
          <Chip
            onClick={() => void escuchar()}
            pressed={sonando}
            tone="quiet"
            className="shrink-0 px-2"
            ariaLabel={sonando ? 'Parar lo que estás probando' : 'Escuchar lo que estás probando'}
            title={sonando ? 'Parar' : 'Escuchar lo que estás probando'}
          >
            {sonando ? <IconoParar /> : <IconoSonar />}
          </Chip>

          <ol
            aria-label="Lo que estás probando"
            className="flex min-w-0 grow items-center gap-1 overflow-x-auto"
          >
            {path.map((chord, index) => {
              const ultimo = index === path.length - 1;
              const suena = pasoSonando === index;
              return (
                <li key={`${chord.symbol}-${index}`} className="flex shrink-0 items-center gap-1">
                  {index > 0 && (
                    <span className="text-text-muted text-xs" aria-hidden="true">
                      →
                    </span>
                  )}
                  {/*
                    Cada acorde, del tamaño de un dedo y diciendo qué pasa al
                    pulsarlo.

                    Medían **dieciséis por veinticuatro**, sin nombre propio, y
                    al pulsarlos cortan la progresión por ahí. Tres cosas malas a
                    la vez: en un teléfono no se aciertan; si se aciertan, se
                    pierde la cola sin haber pedido nada; y quien no ve la
                    pantalla solo oía la letra del acorde, que no dice que sea un
                    botón de cortar.

                    El grado debajo no es adorno: es el vocabulario que esta
                    aplicación enseña, y aquí sale gratis decirlo.
                  */}
                  <button
                    type="button"
                    onClick={() => actions.trimPath(index)}
                    aria-label={
                      ultimo
                        ? `${chord.symbol}, ${chord.label}, el último`
                        : `Cortar después de ${chord.symbol}, ${chord.label}`
                    }
                    title={ultimo ? chord.why : `Cortar aquí y quitar lo que viene después`}
                    className={`min-h-tap min-w-tap flex cursor-pointer flex-col items-center justify-center rounded-md px-2 leading-tight transition-colors ${
                      suena
                        ? 'bg-brass-dim/30 text-brass-bright'
                        : ultimo
                          ? 'text-brass-bright hover:bg-surface-raised'
                          : 'text-text-muted hover:text-text hover:bg-surface-raised'
                    }`}
                  >
                    <span className="font-mono text-sm">{chord.symbol}</span>
                    <span className="font-mono text-[10px] opacity-70" aria-hidden="true">
                      {chord.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={() => actions.clearPath()}
            aria-label="Limpiar lo que estás probando"
            title="Limpiar"
            className="text-text-muted hover:text-oxblood-bright min-h-tap inline-flex shrink-0 cursor-pointer items-center px-1"
          >
            <IconoCerrar />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Cómo se hace el acorde que has elegido.
 *
 * La zona está siempre **mientras haya acorde**: si apareciera y desapareciera al
 * cambiar de uno a otro, lo que va debajo —lo que estás tocando— se movería de
 * sitio cada vez, y se acaba mirando dónde estaba en vez de mirar el mástil.
 *
 * Sin ningún acorde todavía **no hay nada, ni el rótulo**. Estaba, y decía «Pulsa
 * un acorde de la lista y aquí sale cómo se hace» justo debajo de otro panel que
 * ya decía lo mismo con otras palabras. Dos veces la misma instrucción en una
 * pantalla vacía no ayuda el doble: se lee como que algo no ha cargado.
 */
export function Voicings() {
  const path = useSessionStore((state) => state.path);
  // El bloque elegido manda sobre el camino: si has pinchado un acorde de tu
  // canción, lo que quieres ver en el mástil es **ese**, no el último que
  // andabas probando.
  const elegido = useAcordeElegido();
  const current = elegido ?? path.at(-1) ?? null;

  if (current === null) {
    return null;
  }

  return (
    <section aria-label="Formas del acorde elegido" className="border-border shrink-0 border-b">
      <p className="rotulo px-3 pt-2">{elegido === null ? 'Elegido' : 'En la canción'}</p>
      <VoicingList chord={current} />
    </section>
  );
}

export function NextChords({
  onPoner,
}: {
  /**
   * Qué hacer con un acorde que cabe en la canción. Sin esto, la lista solo
   * lleva al camino, que es lo que hace donde no hay montaje que escribir.
   */
  readonly onPoner?: (degree: DegreeSymbol, especie?: EspecieDeBloque) => void;
} = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const actions = useSessionStore((state) => state.actions);
  const styleId = useSessionStore((state) => state.styleId);
  const history = useSessionStore((state) => state.noteHistory);
  const acciones = useArrangementStore((state) => state.actions);

  // Igual que el mástil: se propone **desde el bloque que tienes elegido** si lo
  // hay. Sin esto, con media canción escrita delante esta lista seguía diciendo
  // «Por dónde empezar», que es justo lo que ya ofrece el lienzo: dos listas
  // compitiendo por el mismo hueco de la cabeza
  // ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
  const elegido = useAcordeElegido();
  const current = elegido ?? path.at(-1) ?? null;
  const playedNotes = useMemo(() => history.map((note) => note.pitchClass), [history]);

  const inKey = useMemo(
    () =>
      new Set<PitchClass>(
        activeKey === null
          ? []
          : scaleNotes(activeKey.tonic, activeKey.mode === 'major' ? 'major' : 'naturalMinor'),
      ),
    [activeKey],
  );

  const options = useMemo(() => {
    if (activeKey === null) {
      return [];
    }
    const base = { tonic: activeKey.tonic, mode: activeKey.mode, styleId, playedNotes };
    return current === null
      ? suggestChords({ ...base, limit: 14 })
      : suggestTransitions({ ...base, from: current, limit: 14 });
  }, [activeKey, styleId, playedNotes, current]);

  return (
    // El alto lo pide solo en pantalla ancha, que es donde vive en una columna
    // con altura propia. Apilado en el móvil, `h-full` dentro de una fila que se
    // mide por su contenido deja un hueco vacío por el que se puede desplazar.
    <div className="flex flex-col lg:h-full">
      <div className="border-border border-b p-2">
        {/* El buscador escribe donde escribe la lista de abajo: si no, la
            misma área haría dos cosas distintas según dónde pulsaras. Lo que no
            tiene grado sigue yendo al camino, igual que ahí. */}
        <ChordSearch
          onPick={(chord) => {
            const puesto =
              activeKey === null
                ? null
                : comoBloque(activeKey.tonic, activeKey.mode, chord.root, chord.notes);
            if (puesto !== null && onPoner !== undefined) {
              onPoner(puesto.degree, puesto.especie);
              return;
            }
            actions.pushChord(fromSearch(chord));
          }}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 pt-2">
        <p className="rotulo">
          {current === null ? 'Por dónde empezar' : `Desde ${current.symbol}`}
        </p>
        {/* Lo que significan los puntos, al lado de los puntos: preguntarse qué
            era el ámbar y no tenerlo delante es perder el hilo de lo que tocas. */}
        <p aria-hidden="true" className="text-text-muted flex items-center gap-2 text-xs">
          {/* La leyenda lleva las mismas formas que la lista, o dejaría de
              explicarla: un punto redondo aquí y un rombo allí es otra cosa. */}
          <span className="flex items-center gap-1">
            <Marca tono="entra" />
            entra
          </span>
          <span className="flex items-center gap-1">
            <Marca tono="color" />
            color
          </span>
          <span className="flex items-center gap-1">
            <Marca tono="fuera" />
            fuera
          </span>
        </p>
        {/* Lo mismo con las letras: T, S y D no significan nada hasta que
            alguien te las traduce, y tenerlo delante evita ir a buscarlo. */}
        <p aria-hidden="true" className="text-text-muted flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="border-border rounded-sm border px-1 font-mono">T</span>
            reposo
          </span>
          <span className="flex items-center gap-1">
            <span className="border-border rounded-sm border px-1 font-mono">S</span>
            salida
          </span>
          <span className="flex items-center gap-1">
            <span className="border-border rounded-sm border px-1 font-mono">D</span>
            tensión
          </span>
        </p>
      </div>

      <ul className="min-h-0 grow space-y-0.5 overflow-y-auto p-2">
        {options.map((option, indice) => {
          /**
           * Si este acorde se puede escribir en la canción, y cómo.
           *
           * Un bloque guarda **un grado y su séptima**, así que un `Fmaj7` cabe
           * entero y un `F5` no: sin tercera no hay grado que guardar. Lo que no
           * cabe se queda en el camino, que es para lo que está el camino
           * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
           *
           * Las dos piezas son las mismas que usa el buscador del lienzo, y por
           * lo mismo: la tríada sale de las notas y la séptima también, así que
           * no hace falta una tabla de sufijos aparte que se pueda desincronizar.
           */
          const bloque =
            activeKey === null
              ? null
              : comoBloque(activeKey.tonic, activeKey.mode, option.root, option.notes);
          const sePuedeEscribir = onPoner !== undefined && bloque !== null;

          /**
           * El porqué se dice una vez por fundamental, no una por variante.
           *
           * El motivo del encadenado depende del **movimiento del bajo**, así que
           * F, Fmaj7, F5 y Fsus2 comparten el mismo: son el mismo salto con otra
           * especie encima. Repetido en cada fila salían cuatro «Cae por quintas:
           * el encadenado más fuerte que hay» seguidos, y una lista que dice
           * cuatro veces lo mismo se lee como si estuviera rota.
           *
           * Lo que distingue a las variantes es el cifrado, que está a la
           * izquierda y se lee de un vistazo.
           */
          const anterior = options[indice - 1];
          const porque =
            'motionWhy' in option && typeof option.motionWhy === 'string' && option.motionWhy !== ''
              ? option.motionWhy
              : option.why;
          const repetido =
            anterior !== undefined &&
            anterior.root === option.root &&
            porque ===
              ('motionWhy' in anterior &&
              typeof anterior.motionWhy === 'string' &&
              anterior.motionWhy !== ''
                ? anterior.motionWhy
                : anterior.why);

          return (
            <li key={option.symbol}>
              <button
                type="button"
                onClick={() => {
                  // Lo que cabe en un bloque **entra en la canción**, que es lo
                  // que decidió el ADR 0032: esta lista ya está en su sitio y
                  // solo falta decir que sí. Lo que no cabe —un `F5`, un
                  // `Fsus2`— sigue el camino de siempre: se suelta lo elegido y
                  // se prueba, que para eso está el camino.
                  if (sePuedeEscribir) {
                    onPoner(bloque.degree, bloque.especie);
                    return;
                  }
                  acciones.elegirBloque(null);
                  actions.pushChord(option);
                }}
                // Se dice qué va a pasar al pulsarlo, que son dos cosas
                // distintas: unos entran en la canción y otros solo se prueban.
                // Sin decirlo, la misma lista hace dos cosas sin avisar.
                aria-label={`${option.symbol}, ${option.label}. ${
                  sePuedeEscribir ? 'Ponerlo en la canción' : 'Probarlo'
                }`}
                title={
                  sePuedeEscribir
                    ? `Poner ${option.symbol} en la canción`
                    : `Probar ${option.symbol}. No entra en la canción: el montaje guarda grados, y este acorde no tiene uno.`
                }
                className="hover:bg-surface-raised focus-visible:bg-surface-raised block w-full cursor-pointer rounded-md px-3 py-2 text-left transition-colors"
              >
                {/*
                  Dos renglones, no uno.

                  Estaba todo en fila —marca, cifrado de ancho fijo, grado de
                  ancho fijo, chapa y el porqué en lo que sobrara—, y en la
                  columna de componer «lo que sobraba» eran ciento treinta
                  píxeles: cuatro palabras por línea, cuatro líneas y un
                  `line-clamp-2` cortando la frase a la mitad. La explicación de
                  por qué un acorde sigue a otro es **lo que se viene a leer
                  aquí**, y estaba en la rendija más estrecha de la pantalla.

                  Arriba, lo que se busca de un vistazo bajando por la lista: la
                  marca, el cifrado y su grado. Abajo, la frase a todo el ancho.
                */}
                <span className="flex items-center gap-2">
                  {/* Marcado como señal para que la marca siga ahí mientras
                      grabas: es lo único que da tiempo a mirar tocando. */}
                  <Marca tono={safetyTone(option.notes, inKey)} senal />
                  <span className="text-text font-mono text-base">{option.symbol}</span>
                  <span className="text-text-muted font-mono text-xs">{option.label}</span>
                  <RoleBadge role={option.role} />
                </span>

                {(repetido ? '' : porque) !== '' && (
                  <span className="text-text-muted mt-0.5 block text-sm leading-snug">
                    {porque}
                  </span>
                )}

                {/* Por qué se puede cambiar por otro. Va debajo y más pequeño
                    que el porqué del acorde: primero se entiende qué es, y
                    después por dónde se puede sustituir. */}
                {option.substitution !== null ? (
                  <span className="text-text-muted mt-0.5 block text-xs leading-snug">
                    Vale por {option.substitution.of}. {option.substitution.why}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
