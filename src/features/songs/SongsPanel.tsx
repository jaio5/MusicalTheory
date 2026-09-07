'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { can, cheapestPlanWith } from '@core/billing';
import {
  arrangementFromSong,
  defaultSectionName,
  degreesFromPath,
  sectionsFromArrangement,
  describeSong,
  keyName,
  MAX_SECTIONS,
  MAX_SONG_NAME,
  parseSong,
  resolveDegree,
  sortSongs,
  type Song,
} from '@core/music';
import { apiErrorFrom } from '@state/api-error';
import { useAccount } from '@state/account';
import { useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { TextField } from '@ui/TextField';
import { PlanLock } from '@ui/PlanLock';

export interface SongsPanelProps {
  /** Se inyecta en los tests para no llamar al servidor de verdad. */
  readonly request?: (init: RequestInit & { method: string }) => Promise<Response>;
}

async function defaultRequest(init: RequestInit & { method: string }): Promise<Response> {
  return fetch('/api/canciones', {
    ...init,
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
}

/**
 * Pide la lista y la interpreta, sin tocar el estado de React.
 *
 * Cada canción pasa por `parseSong` aunque venga del propio servidor: es la
 * misma regla que sigue el avance, y aquí además protege de una fila con el
 * documento a medias, que se cae de la lista en vez de tumbarla entera.
 */
async function leerCanciones(
  request: (init: RequestInit & { method: string }) => Promise<Response>,
): Promise<{ readonly songs: readonly Song[]; readonly error: string | null }> {
  try {
    const response = await request({ method: 'GET' });
    if (!response.ok) {
      return {
        songs: [],
        error: (await apiErrorFrom(response, 'No hemos podido leer tus canciones.')).message,
      };
    }
    const body = (await response.json()) as { songs?: unknown };
    const list = Array.isArray(body.songs) ? body.songs : [];

    return {
      songs: sortSongs(
        list
          .map((raw: unknown) =>
            parseSong(raw, typeof (raw as Song).id === 'string' ? (raw as Song).id : ''),
          )
          .filter((song): song is Song => song !== null),
      ),
      error: null,
    };
  } catch {
    return { songs: [], error: 'No hemos podido leer tus canciones. Comprueba la conexión.' };
  }
}

/**
 * Tus canciones: guardar la progresión que llevas y volver a ella.
 *
 * Guardar y abrir son las dos únicas cosas que hace, y las dos pasan por el
 * mismo permiso que comprueba la ruta: preguntando los dos a `core/billing` no
 * puede pasar que aquí salga un botón que el servidor va a rechazar.
 *
 * Lo que sube son **grados**, no cifrados, así que abrir una canción en otra
 * tonalidad la transporta sola. Y lo que no es un grado del modo —un dominante
 * secundario, que se escribe con barra— no se puede guardar todavía: se dice
 * cuántos se han quedado fuera en vez de perderlos en silencio.
 */
export function SongsPanel({ request = defaultRequest }: SongsPanelProps = {}) {
  const { account, signedIn } = useAccount();
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  // El tempo del metrónomo entra en la canción: es lo que hace que al abrirla
  // mañana suene a la velocidad a la que la escribiste.
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  /**
   * El montaje manda sobre el camino cuando tiene algo dentro.
   *
   * Son las dos caras de componer y las dos hacen canciones, pero no dicen lo
   * mismo: el camino es la progresión que llevas encadenada de una tirada y el
   * montaje son partes con nombre, con lo que dura cada acorde y con el punteo.
   * Si hay montaje, guardar el camino sería guardar la mitad pequeña.
   */
  const arrangement = useArrangementStore((state) => state.arrangement);
  const accionesMontaje = useArrangementStore((state) => state.actions);

  const puedeGuardar = can(account.plan, 'canciones');

  const [songs, setSongs] = useState<readonly Song[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Qué canción se está renombrando, y con qué nombre. Nulo: ninguna. */
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);

  // Leer va aparte y **devuelve** lo leído en vez de escribirlo en el estado.
  // Así el único `setState` de este componente que sale de un efecto ocurre
  // detrás de un `await`, que es lo que distingue sincronizar con el servidor de
  // encadenar repintados.
  // La forma de pedir se guarda en una `ref`, como hace `SessionsPanel` con su
  // almacén. No es ceremonia: colgando `refresh` directamente del prop, el
  // efecto que lista al montar vuelve a dispararse en cada repintado del padre
  // —cada nota que suena repinta componer— y la lista se pediría veinte veces
  // por segundo. Con la `ref`, `refresh` es estable y el efecto corre una vez.
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  // Leer va aparte y **devuelve** lo leído en vez de escribirlo en el estado.
  const refresh = useCallback(async () => {
    const leido = await leerCanciones(requestRef.current);
    setSongs(leido.songs);
    setMessage(leido.error);
  }, []);

  useEffect(() => {
    if (puedeGuardar) {
      void refresh();
    }
  }, [puedeGuardar, refresh]);

  async function save() {
    if (activeKey === null) {
      setMessage(
        'Elige una tonalidad antes de guardar: una canción sin tonalidad no se puede abrir.',
      );
      return;
    }

    const delMontaje = sectionsFromArrangement(arrangement, beatsPerBar);
    const { degrees, dropped } = degreesFromPath(
      path.map((chord) => chord.label),
      activeKey.mode,
    );

    const sections =
      delMontaje.length > 0 ? delMontaje : [{ name: defaultSectionName(0), degrees }];

    if (sections.every((section) => section.degrees.length === 0)) {
      setMessage('Encadena algún acorde antes de guardar: una canción necesita al menos uno.');
      return;
    }

    setBusy(true);
    setMessage(null);
    setNote(null);

    try {
      const response = await request({
        method: 'POST',
        body: JSON.stringify({
          name,
          tonic: activeKey.tonic,
          mode: activeKey.mode,
          bpm,
          sections,
        }),
      });

      if (!response.ok) {
        setMessage((await apiErrorFrom(response, 'No hemos podido guardar la canción.')).message);
        return;
      }

      setName('');
      // Lo que se ha quedado fuera se dice **después** de guardar y como aviso,
      // no como error: la canción está guardada, y callarlo haría que al abrirla
      // apareciera una progresión más corta sin explicación.
      //
      // Solo pasa guardando el camino: los acordes del montaje ya son grados, así
      // que de allí no se cae ninguno.
      if (delMontaje.length === 0 && dropped > 0) {
        setNote(
          dropped === 1
            ? 'Un acorde no es un grado de esta tonalidad y no se ha guardado.'
            : `${dropped} acordes no son grados de esta tonalidad y no se han guardado.`,
        );
      }
      await refresh();
    } catch {
      setMessage('No hemos podido guardar la canción. Comprueba la conexión.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Escribe encima de una canción que ya existe.
   *
   * Manda la canción entera y no solo lo que cambia: el contrato la interpreta
   * con la misma función con la que interpreta lo que llega de Postgres, y una
   * canción a medias no pasaría esa comprobación. Es una petición más grande y
   * una regla menos que mantener.
   */
  async function guardarEncima(song: Song, cambios: Partial<Song>): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await request({
        method: 'PUT',
        body: JSON.stringify({ ...song, ...cambios }),
      });
      if (!response.ok) {
        setMessage((await apiErrorFrom(response, 'No hemos podido guardar el cambio.')).message);
        return false;
      }
      await refresh();
      return true;
    } catch {
      setMessage('No hemos podido guardar el cambio. Comprueba la conexión.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Añade lo que llevas encadenado como una parte más de esa canción.
   *
   * Es lo que da sentido a que una canción tenga secciones: hasta ahora se
   * guardaba siempre una sola, así que «estrofa» y «estribillo» eran dos
   * canciones distintas con el mismo nombre y un número detrás.
   *
   * Solo se puede si la tonalidad coincide. Meter en una canción en Do una parte
   * que tocaste en Sol guardaría los grados de Sol dentro de una canción de Do, y
   * al abrirla sonaría otra cosa sin que nadie hubiera hecho nada mal.
   */
  async function anadirParte(song: Song) {
    if (activeKey === null) {
      setMessage('Elige una tonalidad antes de añadir una parte.');
      return;
    }
    if (activeKey.tonic !== song.tonic || activeKey.mode !== song.mode) {
      setMessage(
        `«${song.name}» está en ${keyName(song.tonic, song.mode)} y tú estás en ${keyName(
          activeKey.tonic,
          activeKey.mode,
        )}. Cambia de tonalidad o abre la canción antes de añadirle una parte.`,
      );
      return;
    }
    if (song.sections.length >= MAX_SECTIONS) {
      setMessage(`«${song.name}» ya tiene ${MAX_SECTIONS} partes, que es el tope.`);
      return;
    }

    const { degrees, dropped } = degreesFromPath(
      path.map((chord) => chord.label),
      activeKey.mode,
    );
    if (degrees.length === 0) {
      setMessage('Encadena algún acorde antes de añadirlo como parte.');
      return;
    }

    const parte = { name: defaultSectionName(song.sections.length), degrees };
    if (await guardarEncima(song, { sections: [...song.sections, parte] })) {
      setNote(
        dropped > 0
          ? `«${parte.name}» añadida a «${song.name}», sin ${dropped} ${
              dropped === 1 ? 'acorde que no es un grado' : 'acordes que no son grados'
            } de esta tonalidad.`
          : `«${parte.name}» añadida a «${song.name}».`,
      );
    }
  }

  /**
   * Deja la canción puesta en el modo componer.
   *
   * Fija la tonalidad y rehace el camino desde los grados, así que el porqué de
   * cada acorde vuelve a salir del dominio y no de lo que se guardó: si mañana
   * se escribe mejor el papel del cuarto grado, las canciones viejas lo
   * aprovechan sin migrar nada.
   */
  function open(song: Song) {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: song.tonic, mode: song.mode });
    actions.clearPath();

    const degrees = song.sections.flatMap((section) => section.degrees);
    for (const degree of degrees) {
      const chord = resolveDegree(song.tonic, song.mode, degree);
      actions.pushChord({
        symbol: chord.symbol,
        label: degree,
        root: chord.root,
        notes: chord.notes,
        why: chord.role,
      });
    }
    actions.setCurrentDegree(degrees.at(-1) ?? null);

    // Y en el lienzo, con sus partes, su punteo y de dónde salió cada acorde.
    // Abrir una canción tiene que dejarla puesta en las dos caras: son la misma
    // canción vista de dos maneras, no dos sitios distintos.
    accionesMontaje.replace(arrangementFromSong(song, beatsPerBar));

    setNote(`«${song.name}» puesta en ${keyName(song.tonic, song.mode)}.`);
  }

  async function remove(song: Song) {
    setBusy(true);
    try {
      const response = await request({ method: 'DELETE', body: JSON.stringify({ id: song.id }) });
      if (!response.ok) {
        setMessage((await apiErrorFrom(response, 'No hemos podido borrar la canción.')).message);
        return;
      }
      await refresh();
    } catch {
      setMessage('No hemos podido borrar la canción. Comprueba la conexión.');
    } finally {
      setBusy(false);
    }
  }

  if (!puedeGuardar) {
    return (
      <PlanLock
        needed={cheapestPlanWith('canciones')}
        what="Guardar tus canciones"
        signedIn={signedIn}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        {/* Un `<input>` y no `ui/Field`: Field es el desplegable de elegir una
            opción, y aquí se escribe un nombre. El patrón es el mismo que el de
            los formularios de la cuenta. */}
        <TextField
          label="Nombre"
          ancho="crece"
          type="text"
          maxLength={MAX_SONG_NAME}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sin título"
        />
        {/* El botón dice qué se va a guardar, porque no siempre es lo mismo: el
            montaje si lo hay y el camino si no. Enterarse después, con la
            canción guardada a medias, sería peor. */}
        <Button onClick={() => void save()} disabled={busy}>
          {arrangement.parts.length > 0 ? 'Guardar el montaje' : 'Guardar esta progresión'}
        </Button>
      </div>

      <p className="text-text-muted mt-2 text-sm">
        Se guardan en tu cuenta: la tonalidad y los grados, no los cifrados. Por eso una canción
        guardada se puede abrir en otro tono. Con el montaje van también sus partes, el punteo y de
        dónde salió cada acorde. Ni audio ni vídeo, aquí tampoco.
      </p>

      {message !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {message}
        </p>
      )}

      {note !== null && (
        <p role="status" className="text-text-muted mt-4 text-sm">
          {note}
        </p>
      )}

      {songs.length === 0 ? (
        <p className="text-text-muted mt-6 text-sm">Todavía no has guardado ninguna.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {songs.map((song) => (
            <Fila
              key={song.id}
              song={song}
              busy={busy}
              renombrandoA={renombrando?.id === song.id ? renombrando.nombre : null}
              onRenombrar={(nombre) => setRenombrando({ id: song.id, nombre })}
              onDejarlo={() => setRenombrando(null)}
              onGuardarNombre={(nombre) => {
                void guardarEncima(song, { name: nombre }).then((ok) => {
                  if (ok) {
                    setRenombrando(null);
                  }
                });
              }}
              onAbrir={() => open(song)}
              onAnadirParte={() => void anadirParte(song)}
              onBorrar={() => void remove(song)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Una canción de la lista.
 *
 * Aparte del panel porque tiene **dos modos** —mirándola y renombrándola— y
 * dentro del `.map` eso eran noventa líneas con tres niveles de anidamiento: el
 * bloque de renombrar quedaba tan adentro que había que contar llaves para saber
 * de qué era el `else`.
 *
 * No sabe nada del servidor ni de la sesión: recibe la canción y qué hacer con
 * cada botón. Todo lo que decide sigue decidiéndose en el panel.
 */
function Fila({
  song,
  busy,
  renombrandoA,
  onRenombrar,
  onDejarlo,
  onGuardarNombre,
  onAbrir,
  onAnadirParte,
  onBorrar,
}: {
  readonly song: Song;
  readonly busy: boolean;
  /** El nombre que se está escribiendo, o nulo si no se está renombrando. */
  readonly renombrandoA: string | null;
  readonly onRenombrar: (nombre: string) => void;
  readonly onDejarlo: () => void;
  readonly onGuardarNombre: (nombre: string) => void;
  readonly onAbrir: () => void;
  readonly onAnadirParte: () => void;
  readonly onBorrar: () => void;
}) {
  return (
    <li className="border-border border-b pb-2">
      {renombrandoA === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="text-text block truncate text-sm">{song.name}</span>
            <span className="text-text-muted block font-mono text-xs">
              {keyName(song.tonic, song.mode)} · {describeSong(song)}
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={onAbrir}>
              Abrir
            </Button>
            <Button
              variant="quiet"
              onClick={onAnadirParte}
              disabled={busy}
              title="Añade lo que llevas encadenado como una parte más"
            >
              Añadir parte
            </Button>
            <Button variant="quiet" onClick={() => onRenombrar(song.name)}>
              Renombrar
            </Button>
            <Button variant="quiet" onClick={onBorrar} disabled={busy}>
              Borrar
            </Button>
          </span>
        </div>
      ) : (
        // Renombrar sustituye la fila en vez de abrir otra cosa: el nombre se
        // cambia mirándolo, y sacarlo a un sitio aparte obliga a recordar cuál
        // era el de antes.
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onGuardarNombre(renombrandoA);
          }}
        >
          {/* «Nombre nuevo» y no «Nombre»: el de guardar una canción está a la
              vista al mismo tiempo, y dos campos con la misma etiqueta no los
              distingue ni un lector de pantalla. */}
          <TextField
            label="Nombre nuevo"
            ancho="crece"
            type="text"
            autoFocus
            maxLength={MAX_SONG_NAME}
            value={renombrandoA}
            onChange={(event) => onRenombrar(event.target.value)}
          />
          <Button type="submit" disabled={busy}>
            Guardar
          </Button>
          <Button variant="quiet" onClick={onDejarlo}>
            Dejarlo
          </Button>
        </form>
      )}

      {/* Las partes, cuando hay más de una. Con una sola no aportan nada: la
          canción **es** esa parte. */}
      {song.sections.length > 1 && (
        <ol className="text-text-muted mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
          {song.sections.map((section, index) => (
            <li key={`${song.id}-${index}`}>
              <span className="text-text">{section.name}:</span> {section.degrees.join(' ')}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
