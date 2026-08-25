'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { can, cheapestPlanWith } from '@core/billing';
import {
  degreesFromPath,
  describeSong,
  keyName,
  MAX_SONG_NAME,
  parseSong,
  resolveDegree,
  sortSongs,
  type Song,
} from '@core/music';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
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

/** Lo que dijo el servidor, o una frase cuando no dijo nada legible. */
async function messageOf(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body.error?.message;
    return typeof message === 'string' && message !== '' ? message : fallback;
  } catch {
    return fallback;
  }
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
      return { songs: [], error: await messageOf(response, 'No hemos podido leer tus canciones.') };
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

  const puedeGuardar = can(account.plan, 'canciones');

  const [songs, setSongs] = useState<readonly Song[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

    const { degrees, dropped } = degreesFromPath(
      path.map((chord) => chord.label),
      activeKey.mode,
    );

    if (degrees.length === 0) {
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
          sections: [{ name: 'Parte 1', degrees }],
        }),
      });

      if (!response.ok) {
        setMessage(await messageOf(response, 'No hemos podido guardar la canción.'));
        return;
      }

      setName('');
      // Lo que se ha quedado fuera se dice **después** de guardar y como aviso,
      // no como error: la canción está guardada, y callarlo haría que al abrirla
      // apareciera una progresión más corta sin explicación.
      if (dropped > 0) {
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
    setNote(`«${song.name}» puesta en ${keyName(song.tonic, song.mode)}.`);
  }

  async function remove(song: Song) {
    setBusy(true);
    try {
      const response = await request({ method: 'DELETE', body: JSON.stringify({ id: song.id }) });
      if (!response.ok) {
        setMessage(await messageOf(response, 'No hemos podido borrar la canción.'));
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
        plural
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
        <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
          <span className="text-text-muted text-xs">Nombre</span>
          <input
            type="text"
            maxLength={MAX_SONG_NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sin título"
            className="border-border bg-background text-text placeholder:text-text-muted rounded-md border px-2 py-2 text-base"
          />
        </label>
        <Button onClick={() => void save()} disabled={busy}>
          Guardar esta progresión
        </Button>
      </div>

      <p className="text-text-muted mt-2 text-sm">
        Se guardan en tu cuenta: la tonalidad y los grados, no los cifrados. Por eso una canción
        guardada se puede abrir en otro tono. Ni audio ni vídeo, aquí tampoco.
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
            <li
              key={song.id}
              className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-2"
            >
              <span className="min-w-0">
                <span className="text-text block truncate text-sm">{song.name}</span>
                <span className="text-text-muted block font-mono text-xs">
                  {keyName(song.tonic, song.mode)} · {describeSong(song)}
                </span>
              </span>
              <span className="flex gap-2">
                <Button variant="quiet" onClick={() => open(song)}>
                  Abrir
                </Button>
                <Button variant="quiet" onClick={() => void remove(song)} disabled={busy}>
                  Borrar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
