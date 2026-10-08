'use client';

import { enLista } from '@core/cifras';
import { blockChord, type PitchClass } from '@core/music';
import { useArrangementStore, type QuitadosAlCambiarDeModo } from '@state/arrangement-store';
import { useClaqueta } from '@state/claqueta';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Aviso } from '@ui/Aviso';
import { Chip } from '@ui/Chip';

/**
 * Lo que un cambio de modo dejó fuera, dicho en una frase.
 *
 * Los cifrados van en el modo **de antes**, que es el que tenía esos grados: en
 * el de ahora no existen, y por eso se quitaron.
 */
function fraseDeLoQuitado(tonica: PitchClass, { hacia, bloques }: QuitadosAlCambiarDeModo): string {
  const antes = hacia === 'minor' ? 'major' : 'minor';
  const nombres = bloques.map(
    (bloque) => `${blockChord(tonica, antes, bloque).symbol} (${bloque.degree})`,
  );
  const lista = enLista(nombres);
  const modo = hacia === 'minor' ? 'menor' : 'mayor';
  return nombres.length === 1
    ? `Al pasar a ${modo} se ha quitado ${lista}: en ${modo} no tiene sitio.`
    : `Al pasar a ${modo} se han quitado ${lista}: en ${modo} no tienen sitio.`;
}

/**
 * Una franja de aviso sobre la canción, con lo que se puede hacer con él.
 *
 * La región viva va montada siempre y vacía (`ui/Aviso`): una que nace con el
 * texto dentro no se lee en todos los lectores. La franja solo ocupa sitio
 * cuando hay algo que decir.
 */
function Franja({
  frase,
  tono = 'error',
  children,
}: {
  readonly frase: string | null;
  readonly tono?: 'error' | 'hecho';
  readonly children: React.ReactNode;
}) {
  return (
    <div
      className={
        frase === null ? '' : 'border-border flex shrink-0 items-start gap-3 border-b px-3 py-2'
      }
    >
      <Aviso mensaje={frase} tono={tono} className="min-w-0 grow text-xs" />
      {frase !== null && <span className="flex shrink-0 gap-2">{children}</span>}
    </div>
  );
}

/**
 * **Lo que se quitó al cambiar de modo, dicho.** Traducir la canción a otro modo
 * deja fuera los grados que allí no existen —un `V/ii` no tiene sitio en menor—,
 * y se quitaban sin avisar: se cambiaba la rueda y la canción tenía un acorde
 * menos sin que nadie supiera por qué.
 *
 * En la pantalla y no en el lienzo porque el modo se cambia desde cualquier
 * espacio, y en Tocando o en Ensayar el lienzo no está. **Durante una toma se
 * calla**: la voz del lector sale por el mismo altavoz que el clic, con el micro
 * abierto, y cuando acaba la toma vuelve a estar.
 */
export function LoQueSeQuito() {
  const quitados = useArrangementStore((state) => state.quitadosAlCambiarDeModo);
  const olvidar = useArrangementStore((state) => state.actions.olvidarQuitados);
  const enLaToma = useClaqueta((estado) => estado.enLaToma);
  const tonica = useSessionStore((state) => selectActiveKey(state)?.tonic ?? null);
  const frase =
    quitados === null || enLaToma || tonica === null ? null : fraseDeLoQuitado(tonica, quitados);

  return (
    <Franja frase={frase}>
      <Chip onClick={olvidar} tone="quiet" tamano="compacto">
        Vale
      </Chip>
    </Franja>
  );
}

/**
 * **La canción ha cambiado en otra pestaña, y se dice.**
 *
 * Con dos pestañas abiertas cada una guardaba la suya encima de la de la otra
 * sin avisar. Ahora lo que se escribe en una llega a las demás
 * (`state/arrangement-store.ts`), y llegar sin una frase sería la canción
 * cambiando sola delante de quien la mira. Se ofrece deshacer porque es lo único
 * que esta pestaña podría echar de menos: lo que tenía antes
 * ([adr/0118](../../../../docs/adr/0118-la-cancion-vive-en-este-navegador-y-se-dice.md)).
 */
export function LoDeOtraPestana() {
  const llego = useArrangementStore((state) => state.llegoDeOtraPestana);
  const acciones = useArrangementStore((state) => state.actions);
  const enLaToma = useClaqueta((estado) => estado.enLaToma);
  const frase =
    llego && !enLaToma
      ? 'Esta canción se ha cambiado en otra pestaña, y aquí ya está como allí.'
      : null;

  return (
    <Franja frase={frase} tono="hecho">
      <Chip
        onClick={() => {
          acciones.undo();
          acciones.olvidarOtraPestana();
        }}
        tone="quiet"
        tamano="compacto"
      >
        Volver a la de aquí
      </Chip>
      <Chip onClick={acciones.olvidarOtraPestana} tone="quiet" tamano="compacto">
        Vale
      </Chip>
    </Franja>
  );
}
