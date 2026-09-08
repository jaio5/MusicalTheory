'use client';

import { useMemo, useState } from 'react';

import {
  degreeOfChord,
  keyName,
  resolveDegree,
  suggestChordSymbols,
  triadInside,
  type DegreeSymbol,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import { TextField } from '@ui/TextField';

/**
 * Escribir un acorde en vez de buscarlo en una lista.
 *
 * Es la otra mitad de poner acordes, y hace falta desde que existe la partitura:
 * quien lee una partitura sabe cómo se llama el acorde que quiere y teclearlo es
 * más corto que buscarlo entre las propuestas. Quien no lo sabe sigue teniendo la
 * lista de al lado, con su porqué en una línea.
 *
 * **Lo que se escribe se convierte en un grado, y si no cabe no entra.** El
 * montaje guarda grados —igual que `song.ts`, y por lo mismo: un `Sol` solo
 * significa algo en su tonalidad— así que un acorde que no es ninguno de los
 * grados del modo no se puede poner. Se dice en vez de callarlo: dejarlo escrito
 * en un campo que no hace nada es peor que un «ese no cabe aquí».
 *
 * El buscador es el del dominio, el mismo que usa la pantalla de acordes: se
 * teclea la fundamental y salen las especies.
 */
export interface ChordEntryProps {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly onPick: (degree: DegreeSymbol) => void;
}

/** Cuántos candidatos se enseñan. Con la fundamental escrita salen de sobra. */
const CUANTOS = 6;

export function ChordEntry({ tonic, mode, onPick }: ChordEntryProps) {
  const [texto, setTexto] = useState('');

  /**
   * Los candidatos, cada uno con el grado que sería aquí.
   *
   * El grado se calcula sobre la **tríada** que hay debajo: un Cmaj7 y un C son
   * el mismo grado, y es esa tríada la que sabe localizarlo, como ya hacía la
   * pantalla de acordes.
   */
  const candidatos = useMemo(() => {
    if (texto.trim() === '') {
      return [];
    }
    /**
     * Uno por grado, y no uno por especie.
     *
     * Al escribir «G» el buscador ofrece G, G7, Gmaj7 y G6, y las cuatro entran
     * como el mismo grado: salían **cuatro botones que ponían «G»**, con la misma
     * pinta y el mismo efecto. Se queda el primero de cada grado, que por el
     * orden del catálogo es el más usado. Los que no caben se agrupan por su
     * cifrado, que es lo único que los distingue.
     */
    const vistos = new Set<string>();

    return suggestChordSymbols(texto, CUANTOS * 3)
      .map((chord) => {
        // La especie sale de las notas y no del sufijo, así que un `Cmaj7` y un `C`
        // llegan al mismo grado sin una tabla de sufijos aparte.
        const quality = triadInside(chord.root, chord.notes);
        const degree = quality === null ? null : degreeOfChord(tonic, mode, chord.root, quality);
        return {
          escrito: chord.symbol,
          // La clave de deduplicado: el grado si cabe, y si no el propio cifrado.
          clave: degree ?? chord.symbol,
          // **Lo que se va a poner de verdad.** El montaje guarda grados y un grado
          // es una tríada, así que un `Am7` entra como `Am`. Se enseña el que va a
          // quedar, no el que se ha escrito: enterarse después, con el acorde ya
          // puesto, es peor que verlo antes.
          symbol: degree === null ? chord.symbol : resolveDegree(tonic, mode, degree).symbol,
          degree,
        };
      })
      .filter((candidato) => {
        if (vistos.has(candidato.clave)) {
          return false;
        }
        vistos.add(candidato.clave);
        return true;
      })
      .slice(0, CUANTOS);
  }, [mode, texto, tonic]);

  const ningunoCabe = candidatos.length > 0 && candidatos.every((c) => c.degree === null);

  return (
    <div>
      <TextField
        label="Escribe un acorde"
        compact
        ancho="completo"
        placeholder="Am7, F#, Bb…"
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
      />

      {candidatos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {candidatos.map((candidato) => (
            <li key={candidato.escrito}>
              <button
                type="button"
                disabled={candidato.degree === null}
                onClick={() => {
                  if (candidato.degree !== null) {
                    onPick(candidato.degree);
                    setTexto('');
                  }
                }}
                title={
                  candidato.degree === null
                    ? `${candidato.escrito} no es un grado de ${keyName(tonic, mode)}`
                    : candidato.symbol === candidato.escrito
                      ? `${candidato.symbol}, grado ${candidato.degree}`
                      : `${candidato.escrito} entra como ${candidato.symbol}, grado ${candidato.degree}: se guardan tríadas`
                }
                className="border-border text-text hover:border-brass-dim hover:bg-surface-raised min-h-tap inline-flex cursor-pointer items-center rounded-md border px-3 text-sm font-medium disabled:opacity-35"
              >
                {candidato.symbol}
              </button>
            </li>
          ))}
        </ul>
      )}

      {ningunoCabe && (
        <p className="text-text-muted mt-2 text-xs">
          Ninguno de esos es un grado de {keyName(tonic, mode)}. Se guardan grados y no cifrados,
          que es lo que permite cambiar la canción entera de tonalidad.
        </p>
      )}
    </div>
  );
}
