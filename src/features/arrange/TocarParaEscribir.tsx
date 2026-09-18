'use client';

import { useEffect, useRef, useState } from 'react';

import { keyName } from '@core/music';
import { apuntarLoTocado } from '@state/apuntar-lo-tocado';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useTocarYApuntar, type TocarDeps, type Toma } from '@state/use-tocar-y-apuntar';
import { Aviso } from '@ui/Aviso';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { reloj } from '@core/reloj';
import { IconoDescargar, IconoMicro, IconoParar, IconoSonar } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

/**
 * Componer tocando: una pulsación, y lo que suena se escribe.
 *
 * Esto ya estaba construido entero y no se encontraba: vivía detrás de un botón
 * llamado «apuntar» dentro de la barra del lienzo, y había que acordarse de
 * pulsar después «traer lo grabado»
 * ([adr/0034](../../../docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
 * Aquí es lo único que hay en la pantalla, y es un gesto: empiezas, tocas,
 * paras, y lo tocado ya es una parte de la canción con sus acordes, sus
 * duraciones y su punteo.
 *
 * **Mientras suena se ve que te está oyendo.** El acorde que reconoce, los
 * acordes que lleva apuntados y el tiempo. Sin eso, tocar contra una pantalla
 * quieta es tocar a ciegas; con eso, se sabe en el momento si hay que acercarse
 * al micro o si la tonalidad puesta no es la que estás tocando.
 *
 * Lo que **no** se hace es escribir la partitura nota a nota mientras suena.
 * No se puede honestamente con este motor: fundir las notas repetidas, elegir la
 * figura y cuadrar los compases pide el tramo entero, y hacerlo al vuelo sería
 * enseñar una partitura que se corrige sola mientras la miras.
 */
export function TocarParaEscribir({
  deps = {},
  onEscrito,
}: {
  readonly deps?: TocarDeps;
  /**
   * Llevar a escribir, para ver lo que acaba de entrar.
   *
   * Lo pone quien monta esto, porque cambiar de espacio de trabajo es cosa de la
   * pantalla. Sin esto, parar dejaba la canción escrita y a quien la escribió
   * mirando la misma pantalla de antes, sin saber que había pasado algo.
   */
  readonly onEscrito?: () => void;
} = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const heardChord = useSessionStore((state) => state.heardChord);
  const apuntados = useSessionStore((state) => state.captured.length);

  const { fase, mensaje, segundos, empezar, parar } = useTocarYApuntar(deps);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Si lo último que se tocó llegó a entrar en la canción. */
  const [escrito, setEscrito] = useState(false);
  const [toma, setToma] = useState<Toma | null>(null);

  /**
   * La dirección de la toma, para poder soltarla.
   *
   * Un blob retenido es memoria que no vuelve, y aquí sale uno por cada vez que
   * se toca. La suelta quien la sustituye o quien se va de la pantalla, que no
   * es quien la crea.
   */
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (urlRef.current !== null) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  if (activeKey === null) {
    return (
      // Dentro de una caja que se desplaza, como todo lo que puede no caber: un
      // estado vacío centrado en una caja que recorta se sale por arriba y por
      // abajo en cuanto la ventana es baja.
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="my-auto">
          <Vacio icono={<IconoMicro />} titulo="Elige una tonalidad y toca">
            Lo que toques se escribe en grados sobre la tonalidad que tengas puesta, así que hace
            falta saber cuál es antes de empezar.
          </Vacio>
        </div>
      </div>
    );
  }

  async function pararYEscribir(): Promise<void> {
    setEscrito(false);
    const nueva = await parar();

    if (urlRef.current !== null) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = nueva?.url ?? null;
    setToma(nueva);

    if (activeKey === null) {
      return;
    }
    const apuntado = apuntarLoTocado({
      tonic: activeKey.tonic,
      mode: activeKey.mode,
      bpm,
      beatsPerBar,
    });
    setEscrito(apuntado.partId !== null);
    setAviso(apuntado.aviso);
  }

  function descargar(): void {
    if (toma === null) {
      return;
    }
    const enlace = document.createElement('a');
    enlace.href = toma.url;
    enlace.download = toma.recording.filename;
    enlace.click();
  }

  const tocando = fase === 'tocando';

  return (
    // `my-auto` en el hijo y no `justify-center` aquí, que es la regla de la
    // casa: centrar en una caja que recorta saca lo que no cabe **por los dos
    // lados**, y en una ventana baja el botón se iba por arriba sin manera de
    // alcanzarlo. Así se centra mientras sobra sitio y se desplaza cuando no.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="my-auto flex flex-col items-center gap-4 p-4 text-center">
        <Button
          onClick={() => void (tocando ? pararYEscribir() : empezar())}
          disabled={fase === 'preparando'}
          variant={tocando ? 'quiet' : 'primary'}
          className="min-w-56"
        >
          {tocando ? <IconoParar /> : <IconoMicro />}
          {fase === 'preparando' ? 'Abriendo el micro…' : tocando ? 'Parar y escribirlo' : 'Tocar'}
        </Button>

        {tocando ? (
          // Las tres señales de que te está oyendo, y ninguna más: el acorde que
          // reconoce, cuántos lleva y cuánto tiempo. Un medidor de nivel aquí
          // sería una cuarta cosa mirando a la vez y ninguna se leería.
          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-brass-bright text-4xl leading-none" aria-live="polite">
              {heardChord?.symbol ?? '—'}
            </p>
            <p className="text-text-muted font-mono text-xs">
              {apuntados === 1 ? '1 acorde apuntado' : `${apuntados} acordes apuntados`} ·{' '}
              {segundos}s
            </p>
            <p className="text-text-muted max-w-prose text-sm">
              Toca en {keyName(activeKey.tonic, activeKey.mode)}. Al parar, esto entra en la canción
              como una parte y se puede seguir por bloques o en la partitura.
            </p>
          </div>
        ) : (
          <p className="text-text-muted max-w-prose text-sm">
            Se abre el micro, se graba el sonido y se apunta lo que suena. Al parar, lo tocado entra
            en la canción con sus acordes y su punteo.
          </p>
        )}

        <Aviso mensaje={mensaje} />

        {/* Lo primero que hay que decir al parar es **que ha entrado**, y dónde.
          El aviso de la captura cuenta lo que se perdió, que importa, pero
          después: sin esta línea, parar dejaba la canción escrita y a quien la
          escribió mirando la misma pantalla de antes. */}
        {escrito && (
          <div className="flex flex-col items-center gap-2" role="status">
            <p className="text-tube-bright text-sm">Ya está en la canción.</p>
            {onEscrito !== undefined && (
              <Chip tone="quiet" className="px-3 text-xs" onClick={onEscrito}>
                Verlo en la partitura
              </Chip>
            )}
          </div>
        )}

        <Aviso mensaje={aviso} tono="hecho" anuncio="ninguno" />

        {/* La toma se queda al lado de lo transcrito, y no es adorno: transcribir
          pierde cosas a propósito —dos notas iguales seguidas se funden, el
          croma olvida la octava— y el sonido de verdad es lo que permite
          comprobar qué se perdió. */}
        {toma !== null && !tocando && (
          <div className="border-border flex flex-wrap items-center justify-center gap-2 border-t pt-4">
            <span className="text-text-muted text-xs">Lo que sonó de verdad:</span>
            <audio
              src={toma.url}
              controls
              className="h-8"
              aria-label="La toma que acabas de grabar"
            />
            {/* Cuánto dura, dicho aquí y no dejado al reproductor: el WebM que
              escribe `MediaRecorder` **no lleva la duración en la cabecera**, así
              que el navegador enseña «0:00» de total hasta que la toma se
              reproduce entera. Quien acaba de tocar no puede saber si se grabó un
              compás o los ocho. El número bueno lo tiene la grabación, que lo
              midió mientras grababa. */}
            <span className="text-text-muted font-mono text-xs tabular-nums">
              {reloj(toma.recording.durationMs / 1000)}
            </span>
            <Chip tone="quiet" className="px-3 text-xs" onClick={descargar}>
              <IconoDescargar />
              Descargar
            </Chip>
          </div>
        )}

        {!tocando && toma === null && (
          <p className="text-text-muted flex items-center gap-1 text-xs">
            <IconoSonar />
            El sonido no sale de tu equipo.
          </p>
        )}
      </div>
    </div>
  );
}
