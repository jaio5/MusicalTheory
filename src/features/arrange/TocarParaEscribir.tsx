'use client';

import { descargarUrl } from '@media/descargar';
import { useEffect, useRef, useState } from 'react';

import {
  blockChord,
  degreesFor,
  guionDeEnsayo,
  keyName,
  PAPEL_POR_DEFECTO,
  PAPELES_DE_TOMA,
  writtenBlock,
  type PapelDeLaToma,
} from '@core/music';
import { apuntarLoTocado } from '@state/apuntar-lo-tocado';
import { useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useClaqueta } from '@state/claqueta';
import {
  TOPE_DE_LA_TOMA_S,
  useTocarYApuntar,
  type TocarDeps,
  type Toma,
} from '@state/use-tocar-y-apuntar';
import { Aviso } from '@ui/Aviso';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { Segmentado } from '@ui/Segmentado';
import { reloj } from '@core/reloj';
import { IconoDescargar, IconoMicro, IconoPapelera, IconoParar, IconoSonar } from '@ui/icons';
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
 * No se puede honestamente con este motor: separar los ataques, elegir la
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
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const arrangement = useArrangementStore((state) => state.arrangement);
  // **Lo que se enseña, y no el objeto entero.** La lectura es nueva veinte
  // veces por segundo aunque la nota no cambie, y suscribirse a ella repintaba
  // la pantalla a ese ritmo para acabar escribiendo la misma letra.
  const acordeOido = useSessionStore((state) => state.heardChord?.symbol ?? null);
  const notaOida = useSessionStore((state) => state.reading?.name ?? null);
  const apuntados = useSessionStore((state) => state.captured.length);

  const { fase, mensaje, segundos, cuenta, pulso, empezar, parar } = useTocarYApuntar(deps);
  const volumenDelClic = useClaqueta((estado) => estado.volumen);
  const clicCallado = useClaqueta((estado) => estado.callada);
  const claqueta = useClaqueta((estado) => estado.acciones);
  /**
   * Qué se va a tocar en esta toma.
   *
   * **Se elige antes y no se adivina después.** Los dos motores corren a la vez
   * sobre la misma entrada, así que una toma daba acordes y notas siempre; con
   * esto solo se apunta lo del papel elegido, y el croma deja de escribir
   * acordes encima de un punteo.
   */
  const [papel, setPapel] = useState<PapelDeLaToma>(PAPEL_POR_DEFECTO);
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

  // **A los diez minutos se para sola, y escribe lo tocado.** No es un tope
  // musical: es la red para quien deja el micro abierto y se va
  // (`TOPE_DE_LA_TOMA_S`). Por referencia, porque parar y escribir cambia en cada
  // render y el efecto solo tiene que mirar el reloj.
  // Sin valor de relleno: el primer efecto lo pone antes de que el segundo lo
  // lea, en todos los renders, y una función que nadie llama sería código muerto.
  const alTope = useRef<() => void>(null!);
  useEffect(() => {
    alTope.current = () => void pararYEscribir(true);
  });
  useEffect(() => {
    if (fase === 'tocando' && segundos >= TOPE_DE_LA_TOMA_S) {
      alTope.current();
    }
  }, [fase, segundos]);

  // **Solo grabar no pide tonalidad**, y es lo único que había que salvar del
  // grabador suelto: allí se podía capturar una idea sin haber elegido nada. Los
  // otros dos papeles sí la piden, porque lo que escriben son grados sobre ella
  // ([adr/0056](../../../docs/adr/0056-grabar-es-un-papel-de-la-toma.md)).
  const soloGrabar = papel === 'solo-grabar';

  if (activeKey === null && !soloGrabar) {
    return (
      // Dentro de una caja que se desplaza, como todo lo que puede no caber: un
      // estado vacío centrado en una caja que recorta se sale por arriba y por
      // abajo en cuanto la ventana es baja.
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="my-auto">
          <Vacio icono={<IconoMicro />} titulo="Elige una tonalidad y toca">
            Lo que toques se escribe en grados sobre la tonalidad que tengas puesta, así que hace
            falta saber cuál es antes de empezar. Si solo quieres guardar el sonido, elige «Solo
            grabar» abajo.
          </Vacio>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => setPapel('solo-grabar')} variant="quiet">
              Solo grabar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Cortar la cuenta atrás.
   *
   * No pasa por `pararYEscribir` a propósito: allí se apunta lo tocado, y
   * durante la cuenta no se ha tocado nada, así que lo que salía era «no he
   * podido leer nada». Cancelar no es fallar.
   */
  /**
   * Tirar la toma.
   *
   * Lo traía el grabador suelto y aquí no estaba: la toma solo desaparecía cuando
   * la reemplazaba la siguiente. Al juntarlos había que quedárselo, porque decidir
   * que una toma no vale es la mitad de grabar.
   */
  function tirarLaToma(url: string): void {
    // La dirección entra por parámetro y no se lee de la referencia: el botón solo
    // existe habiendo toma, así que preguntarse si hay alguna sería una rama que no
    // puede darse.
    URL.revokeObjectURL(url);
    urlRef.current = null;
    setToma(null);
  }

  async function dejarlo(): Promise<void> {
    setAviso(null);
    setEscrito(false);
    await parar();
  }

  async function pararYEscribir(porTope = false): Promise<void> {
    setEscrito(false);
    const { toma: nueva, lectura } = await parar();

    if (urlRef.current !== null) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = nueva?.url ?? null;
    setToma(nueva);

    // Sin tonalidad no hay grados sobre los que escribir, y es el caso en que se
    // puede grabar sin haberla elegido. **Que «solo grabar» no escriba lo decide
    // `apuntarLoTocado`**, no esto: es lo que significa ese papel, y saberlo en dos
    // sitios es la manera de que un día digan cosas distintas.
    if (activeKey === null) {
      return;
    }
    // **Con el tempo con el que se contó**, no con el de la pantalla al parar:
    // es contra el que se tocó.
    const apuntado = apuntarLoTocado({
      tonic: activeKey.tonic,
      mode: activeKey.mode,
      bpm: lectura.bpm,
      beatsPerBar: lectura.beatsPerBar,
      papel,
      lectura,
    });
    setEscrito(apuntado.partId !== null);
    const porQue = porTope
      ? `La toma ha llegado a los ${TOPE_DE_LA_TOMA_S / 60} minutos y se ha parado sola.`
      : null;
    setAviso([porQue, apuntado.aviso].filter((texto) => texto !== null).join(' ') || null);
  }

  function descargar(): void {
    /* v8 ignore next 3 -- el boton de descargar solo se pinta con la toma delante */
    if (toma === null) {
      return;
    }
    descargarUrl(toma.url, toma.recording.filename);
  }

  const tocando = fase === 'tocando';
  const contando = fase === 'contando';

  /**
   * Lo que se le dice al lector de pantalla: **pocas frases, y ninguna mientras
   * se apunta.**
   *
   * La voz del lector sale por el mismo altavoz que la claqueta, y el micro ya
   * está abierto: todo lo que diga lo oye, y una voz tiene altura —el motor de
   * tono la escribiría como notas—. Leyendo cada pulso, «siete, seis, cinco» se
   * pisaba con los clics. Así que se dice en dos frases durante la cuenta, y la
   * segunda ya anuncia que **después se graba**: es la manera de decir «grabando»
   * sin decirlo encima del compás uno. Al parar, con el micro ya cerrado, se dice
   * que se ha parado.
   *
   * Solo grabar no cuenta ni transcribe, así que ahí sí se dice «grabando» al
   * empezar: lo que se oiga de la voz no va a escribirse en ninguna parte.
   *
   * La frase se repite igual en todos los pulsos de su compás, así que React no
   * toca el texto y el lector no vuelve a leerla.
   */
  const anuncioDeCuenta = contando
    ? cuenta === null || cuenta === 0
      ? ''
      : cuenta > beatsPerBar
        ? 'Faltan dos compases. El clic sigue sonando mientras tocas.'
        : 'Último compás. Después, grabando.'
    : tocando
      ? soloGrabar
        ? 'Grabando.'
        : 'Último compás. Después, grabando.'
      : toma !== null || escrito
        ? 'Toma parada.'
        : '';

  /**
   * Lo que ya hay escrito, para no tocar a ciegas.
   *
   * Aquí había un botón sobre una pantalla en negro: medido, el 97 % del área
   * vacío. Y lo que se toca **entra como una parte más al final**, así que
   * saber qué hay ya delante es la diferencia entre continuar una canción y
   * grabar encima sin saber dónde.
   *
   * Apagado a propósito: es contexto, no lo que se está haciendo.
   */
  // **Solo los grados que existen en este modo**, y es una red y no el camino.
  // El montaje se traduce al cambiar de modo dentro del mismo `set` que cambia
  // la tonalidad, antes de que React pinte, y la vigilancia está puesta desde
  // que existe el montaje (`state/montaje-en-su-modo.ts`,
  // [adr/0030](../../../docs/adr/0030-cambiar-de-modo-traduce-la-cancion.md)).
  // Se queda porque `blockChord` no perdona un `I` en menor: cuando la
  // traducción dependía de que componer estuviera montada, un grado del modo
  // anterior tumbaba la pantalla entera, y un acorde sin enseñar es mucho menos
  // precio que eso.
  const loQueYaHay =
    activeKey === null
      ? []
      : guionDeEnsayo(arrangement, beatsPerBar).filter((sitio) =>
          degreesFor(activeKey.mode).includes(sitio.degree),
        );

  return (
    // `my-auto` en el hijo y no `justify-center` aquí, que es la regla de la
    // casa: centrar en una caja que recorta saca lo que no cabe **por los dos
    // lados**, y en una ventana baja el botón se iba por arriba sin manera de
    // alcanzarlo. Así se centra mientras sobra sitio y se desplaza cuando no.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="my-auto flex flex-col items-center gap-4 p-4 text-center">
        {!tocando && loQueYaHay.length > 0 && (
          <ol
            aria-label="Lo que ya llevas"
            className="flex max-w-3xl flex-wrap justify-center gap-1.5 opacity-60"
          >
            {loQueYaHay.map((sitio, indice) => (
              <li
                key={`${sitio.blockId}-${indice}`}
                className="border-border text-text-muted rounded-md border px-2.5 py-1 font-mono text-sm"
              >
                {
                  blockChord(activeKey!.tonic, activeKey!.mode, {
                    ...writtenBlock(sitio.blockId, sitio.degree, sitio.beats, sitio.especie),
                  }).symbol
                }
              </li>
            ))}
          </ol>
        )}

        {/* El papel, antes de empezar y no mientras suena: cambiarlo a mitad
            dejaría media toma leída con un motor y media con el otro. Mientras
            se toca se enseña cuál está puesto, que es la mitad de saber qué va a
            entrar. */}
        {tocando ? (
          <p className="rotulo">{PAPELES_DE_TOMA[papel].name}</p>
        ) : (
          <div className="flex flex-col items-center gap-2" data-tour="componer-papel">
            {/* El rótulo se ve y el grupo lo lleva de nombre: el lector lo oye una
                vez, al entrar en el grupo. */}
            <p className="rotulo mb-1 text-center" aria-hidden="true">
              Qué vas a tocar
            </p>
            {/* **Un segmentado y no tres botones.** La elegida iba en latón
                macizo, el mismo que «Tocar» justo debajo, y no se sabía cuál de
                los dos se pulsaba para empezar: elegir un papel dice «está
                puesto», y el latón macizo se queda para la acción. */}
            <Segmentado
              etiqueta="Qué vas a tocar"
              opciones={(Object.keys(PAPELES_DE_TOMA) as PapelDeLaToma[]).map((cual) => ({
                valor: cual,
                texto: PAPELES_DE_TOMA[cual].name,
              }))}
              valor={papel}
              onCambiar={setPapel}
            />
            <p className="text-text-muted max-w-prose text-center text-sm">
              {PAPELES_DE_TOMA[papel].what}
            </p>
          </div>
        )}

        {/* El clic de la toma: quitarlo y bajarlo. **Antes y durante**, porque es
            tocando cuando se descubre que con auriculares sobra. Quitarlo no para
            el pulso: la rejilla sigue sabiendo dónde cae cada compás. Solo
            grabar no lleva clic, así que ahí no se enseña. */}
        {/* El clic y el botón, juntos en una caja para que el recorrido los
            señale a la vez: se explican con la misma frase. Mide lo mismo que
            sueltos, con el mismo hueco entre ellos. */}
        <div className="flex flex-col items-center gap-4" data-tour="componer-tocar">
          {!soloGrabar && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Chip
                tone="quiet"
                tamano="compacto"
                pressed={!clicCallado}
                onClick={() => claqueta.callar(!clicCallado)}
                ariaLabel="Clic durante la toma"
              >
                {clicCallado ? <IconoParar /> : <IconoSonar />}
                {clicCallado ? 'Sin clic' : 'Con clic'}
              </Chip>
              <label className="text-text-muted flex items-center gap-2 text-sm">
                Volumen del clic
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((clicCallado ? 0 : volumenDelClic) * 100)}
                  onChange={(event) => claqueta.ponerVolumen(Number(event.target.value) / 100)}
                  aria-valuetext={
                    clicCallado ? 'Sin clic' : `${Math.round(volumenDelClic * 100)} por ciento`
                  }
                  className="accent-brass min-h-tap w-32"
                />
              </label>
            </div>
          )}

          {/* **Contando también se para**, y con el mismo botón: pulsarlo durante la
            cuenta la corta y no graba nada. Deshabilitarlo ahí dejaba dos
            compases en los que el único botón de la pantalla no hacía nada y
            después arrancaba solo.

            **Y mientras se abre el micro, `cargando` y no `disabled`.** Apagado,
            el botón soltaba el foco justo después de pulsarlo: el navegador lo
            mandaba al `<body>` y el siguiente tabulador empezaba por arriba de
            la página. Así se queda donde estaba y el clic se ignora.

            Solo grabar no escribe nada, y el botón no lo promete: «Grabar» y
            «Parar la grabación», no «Tocar» y «Parar y escribirlo». */}
          <Button
            onClick={() =>
              void (contando ? dejarlo() : tocando ? pararYEscribir() : empezar(!soloGrabar))
            }
            cargando={fase === 'preparando'}
            variant={tocando || contando ? 'quiet' : 'primary'}
            className="min-w-56"
          >
            {tocando || contando ? <IconoParar /> : <IconoMicro />}
            {fase === 'preparando'
              ? 'Abriendo el micro…'
              : contando
                ? 'Dejarlo'
                : tocando
                  ? soloGrabar
                    ? 'Parar la grabación'
                    : 'Parar y escribirlo'
                  : soloGrabar
                    ? 'Grabar'
                    : 'Tocar'}
          </Button>
        </div>

        {/* La cuenta, además de oírse.
            Un número que baja dice cuándo entrar mejor que cuatro clics a los que
            hay que ponerles la cuenta uno mismo, y sobre todo dice **que la
            aplicación está haciendo algo**: dos compases de espera sin nada en
            pantalla se leen como que se ha quedado colgada.

            `tabular-nums` y **no** monoespaciada: la regla la reserva para lo que se
            alinea en columna y esto es una cifra sola
            ([adr/0024](../../../docs/adr/0024-la-interfaz-se-lee-primero.md)).
            Con cifras de ancho fijo ya no salta al bajar de 10 a 9. */}
        {/* El número no se anuncia: lo hace la región de abajo, con menos. */}
        {contando && cuenta !== null && (
          <p className="text-center" aria-hidden="true">
            <span className="text-fluid-hero tabular-nums">{cuenta}</span>
            <span className="text-text-muted mt-1 block text-sm">
              Entra en el uno del tercer compás. El clic sigue mientras tocas.
            </span>
          </p>
        )}
        {/* **Montada siempre, aunque esté vacía.** Un `aria-live` que nace ya con
            el texto dentro no se anuncia en casi ningún lector: se perdía justo
            el primer aviso, que es el que dice cuánto falta. */}
        <p className="sr-only" aria-live="polite">
          {anuncioDeCuenta}
        </p>

        {tocando ? (
          // Las tres señales de que te está oyendo, y ninguna más: el acorde que
          // reconoce, cuántos lleva y cuánto tiempo. Un medidor de nivel aquí
          // sería una cuarta cosa mirando a la vez y ninguna se leería.
          <div className="flex flex-col items-center gap-2">
            {/* «Grabando», a la vista y en el árbol: quien navega con el lector lo
                encuentra aquí, aunque no se anuncie encima del compás uno. */}
            <p className="text-oxblood-bright flex items-center gap-2 text-sm font-medium">
              <span aria-hidden="true" className="bg-oxblood-bright block h-2 w-2 rounded-full" />
              Grabando
            </p>
            {/* La luz del pulso, para quien ha quitado el clic o toca con el ampli
                alto. Se ve y no se anuncia: un pulso hablado es ruido en el micro. */}
            {pulso !== null && (
              <span aria-hidden="true" className="flex gap-1.5">
                {Array.from({ length: beatsPerBar }, (_, indice) => (
                  <span
                    key={indice}
                    className={`block h-2.5 w-2.5 rounded-full ${
                      indice === pulso
                        ? indice === 0
                          ? 'bg-brass-bright'
                          : 'bg-text-muted'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </span>
            )}
            {/* Lo que se enseña es **lo que va a entrar**, no todo lo que el micro
                oye: con un punteo puesto, el acorde que el croma cree reconocer no
                se va a escribir, y enseñarlo sería prometer algo que no pasa. Por
                lo mismo, grabando sin escribir no se enseña nada: no entra nada. */}
            {/* Sin `aria-live`: leído en voz alta, cada acorde saldría por el
                altavoz y el micro lo apuntaría. */}
            {!soloGrabar && (
              <p className="font-display text-brass-bright text-4xl leading-none">
                {papel === 'ritmica' ? (acordeOido ?? '—') : (notaOida ?? '—')}
              </p>
            )}
            <p className="text-text-muted font-mono text-xs">
              {soloGrabar
                ? 'grabando el sonido'
                : papel === 'ritmica'
                  ? apuntados === 1
                    ? '1 acorde apuntado'
                    : `${apuntados} acordes apuntados`
                  : 'escuchando el punteo'}{' '}
              · {segundos}s
            </p>
            {/* **Solo grabar no escribe, tenga tonalidad o no.** Esta línea miraba
                solo la tonalidad, y con una puesta prometía que «esto entra en la
                canción» a una toma que no iba a escribir nada. */}
            <p className="text-text-muted max-w-prose text-sm">
              {soloGrabar || activeKey === null
                ? 'Al parar, la toma se queda aquí para oírla y descargarla. No se escribe nada en la canción.'
                : `Toca en ${keyName(activeKey.tonic, activeKey.mode)}. Al parar, esto entra en la canción como una parte y se puede seguir por bloques o en la partitura.`}
            </p>
          </div>
        ) : soloGrabar ? (
          <p className="text-text-muted max-w-prose text-sm">
            Se abre el micro y se graba el sonido, sin apuntar nada. Al parar, la toma se queda aquí
            para oírla y descargarla, y la canción no cambia.
          </p>
        ) : (
          <p className="text-text-muted max-w-prose text-sm">
            Se abre el micro, se graba el sonido y se apunta lo que suena. Al parar, lo tocado entra
            en la canción. Se graba en tomas separadas —primero la rítmica, luego el punteo— para
            que cada una la lea el motor que sabe hacerla.
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
              <Chip tone="quiet" tamano="compacto" onClick={onEscrito}>
                Verlo en la partitura
              </Chip>
            )}
          </div>
        )}

        <Aviso mensaje={aviso} tono="hecho" anuncio="ninguno" />

        {/* La toma se queda al lado de lo transcrito, y no es adorno: transcribir
          pierde cosas a propósito —no hay tresillos ni ligaduras, el croma
          olvida la octava— y el sonido de verdad es lo que permite comprobar
          qué se perdió. */}
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
            <Chip tone="quiet" tamano="compacto" onClick={descargar}>
              <IconoDescargar />
              Descargar
            </Chip>
            <Chip
              tone="quiet"
              tamano="compacto"
              onClick={() => tirarLaToma(toma.url)}
              ariaLabel="Descartar la toma"
            >
              <IconoPapelera />
              Tirarla
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
