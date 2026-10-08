'use client';

import { useId, useRef, useState, type ChangeEvent } from 'react';

import { escribirCopia, keyName, leerCopia, nombreDeLaCopia } from '@core/music';
import { descargarBytes } from '@media/descargar';
import { useArrangementStore } from '@state/arrangement-store';
import { descargarLaCancion, tituloDeLaCancion } from '@state/descargar-la-cancion';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Aviso } from '@ui/Aviso';
import { Button } from '@ui/Button';
import { IconoDescargar } from '@ui/icons';

/** Lo que dice el fichero de copia que es, para el navegador. */
const TIPO_DE_LA_COPIA = 'application/json';

const SIN_NADA =
  'Todavía no hay nada que descargar: escribe algún acorde en la canción y vuelve aquí.';

/**
 * **Lo primero que dice Canciones: que la tuya ya está guardada.**
 *
 * La canción se guarda sola en este navegador desde que existe el lienzo
 * guardado (`state/session-storage.ts`), y nada lo decía: el panel abría con
 * «Guardar tus canciones entra en el plan Básico», y quien no paga entendía que
 * lo que había escrito se perdería. Era mentira, y la mentira más cara de la
 * aplicación: hacía de pago lo que es gratis.
 *
 * Así que esto va primero y para todos, y ofrece lo que sí cuesta poco tener:
 * **llevársela**. El MIDI, para un secuenciador; la copia, para volver a abrirla
 * aquí con todo —partes, grados, punteo—, en otro navegador o después de borrar
 * los datos del sitio. Lo que da el plan va después y dicho como lo que es:
 * guardarla también en la cuenta y abrirla desde otro aparato
 * ([adr/0118](../../../docs/adr/0118-la-cancion-vive-en-este-navegador-y-se-dice.md)).
 */
export function EnEsteNavegador() {
  const activeKey = useSessionStore(selectActiveKey);
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const arrangement = useArrangementStore((state) => state.arrangement);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const fichero = useRef<HTMLInputElement>(null);
  const titulo = useId();

  /** Lo que hace falta para descargar algo, o nulo si todavía no hay canción. */
  function loQueSeDescarga() {
    const titulo = tituloDeLaCancion(arrangement);
    // Partes sin un acorde todavía no son una canción que llevarse.
    const conAcordes = arrangement.parts.some((parte) => parte.blocks.length > 0);
    if (activeKey === null || titulo === null || !conAcordes) {
      setError(SIN_NADA);
      setHecho(null);
      return null;
    }
    setError(null);
    return { tonalidad: activeKey, titulo };
  }

  function descargarMidi(): void {
    if (loQueSeDescarga() !== null) {
      // El mismo MIDI que baja la barra del lienzo, con el mismo nombre.
      descargarLaCancion();
    }
  }

  function descargarCopia(): void {
    const datos = loQueSeDescarga();
    if (datos === null) {
      return;
    }
    const texto = escribirCopia({
      tonic: datos.tonalidad.tonic,
      mode: datos.tonalidad.mode,
      bpm,
      beatsPerBar,
      arrangement,
    });
    descargarBytes(
      new TextEncoder().encode(texto),
      nombreDeLaCopia(datos.titulo),
      TIPO_DE_LA_COPIA,
    );
  }

  /**
   * Abre una copia: la tonalidad, el tempo y la canción entera.
   *
   * **Con deshacer detrás**: lo que había en el lienzo era trabajo, y abrir una
   * copia encima por error no puede costarlo. Un solo «Deshacer» devuelve la
   * canción de antes con su tonalidad y su tempo (`abrirCopia`).
   */
  async function abrirCopia(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const elegido = evento.target.files?.[0];
    // Se vacía para que elegir el mismo fichero otra vez vuelva a avisar.
    evento.target.value = '';
    if (elegido === undefined) {
      return;
    }
    const copia = leerCopia(await elegido.text());
    if (copia === null) {
      setHecho(null);
      setError(
        'Ese fichero no es una copia de una canción de aquí. Es el que acaba en «.caos.json».',
      );
      return;
    }
    useArrangementStore.getState().actions.abrirCopia(copia);
    setError(null);
    setHecho(
      `Abierta en ${keyName(copia.tonic, copia.mode)}. Si no era esto, «Deshacer» en la canción devuelve la de antes, con su tonalidad y su tempo.`,
    );
  }

  return (
    <section aria-labelledby={titulo} className="flex flex-col gap-2">
      <h3 id={titulo} className="titulo-apartado">
        Tu canción se guarda sola en este navegador
      </h3>
      <p className="text-text-muted">
        Sigue aquí al recargar o al cerrar la pestaña, sin cuenta y sin pagar nada. Se pierde si
        borras los datos del sitio, y en otro aparato no está: para eso, descárgala.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" tamano="compacto" onClick={descargarMidi}>
          <IconoDescargar />
          Descargar MIDI
        </Button>
        <Button variant="quiet" tamano="compacto" onClick={descargarCopia}>
          <IconoDescargar />
          Descargar una copia
        </Button>
        <Button variant="quiet" tamano="compacto" onClick={() => fichero.current?.click()}>
          Abrir una copia
        </Button>
        {/* El campo de fichero va escondido y lo abre el botón: el del navegador
            no se deja dar estilo, y con su «Ningún archivo seleccionado» parecía
            un formulario a medio rellenar. */}
        <input
          ref={fichero}
          type="file"
          accept=".json,application/json"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(evento) => void abrirCopia(evento)}
        />
      </div>
      <p className="text-text-muted text-xs">
        El MIDI se abre en cualquier programa de música. La copia se vuelve a abrir aquí, con las
        partes y todo lo que lleva la canción.
      </p>
      <Aviso mensaje={error} />
      <Aviso mensaje={hecho} tono="hecho" />
    </section>
  );
}
