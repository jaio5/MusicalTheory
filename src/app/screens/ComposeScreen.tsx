'use client';

import { useEffect, type CSSProperties } from 'react';

import { keyName, type ScaleId } from '@core/music';
import { ArrangeCanvas, TocarParaEscribir } from '@features/arrange';
import { FretboardPanel } from '@features/fretboard';
import { GananciaAlComponer, useProgress } from '@features/learn';
import { IdeasPanel } from '@features/ideas';
import { Metronome } from '@features/metronome';
import { CurrentChord, HeardChord, NextChords, Voicings } from '@features/path';
import { Grabadora } from '@features/recorder';
import { ResumeLast, SessionsPanel } from '@features/sessions';
import { SongsPanel } from '@features/songs';
import { VersionsPanel } from '@features/versions';
import { BarraDeTonalidad, KeyPanel } from '@features/wheel';
import { Settings } from '@features/workspace';
import { useBancoStore, type EditorDeAbajo } from '@state/banco';
import { useMontajeEnSuModo } from '@state/montaje-en-su-modo';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { TOPES_DEL_BANCO } from '@state/workspace';
import { Area } from '@ui/Area';
import { Chip } from '@ui/Chip';
import { Divisor } from '@ui/Divisor';
import { EmpezarPorTonalidad } from '@ui/EmpezarPorTonalidad';
import {
  IconoAfinar,
  IconoCanciones,
  IconoCerrar,
  IconoComponer,
  IconoIdeas,
  IconoMastil,
  IconoMicro,
  IconoPunto,
  IconoSalidas,
  IconoSesiones,
  IconoTocar,
} from '@ui/icons';
import { WorkHeader } from '@ui/Screen';

interface Editor {
  readonly id: EditorDeAbajo;
  readonly name: string;
  readonly Icono: () => React.ReactElement;
  readonly render: () => React.ReactElement;
  /**
   * Si lo de dentro se dibuja entero o hay que desplazarlo. El mástil se dibuja
   * entero y no hace scroll nunca; lo demás es texto, y el texto se lee
   * desplazándolo.
   */
  readonly entero?: boolean;
}

/**
 * Los editores que caben en el área de abajo.
 *
 * Es el único sitio donde se elige **qué** se ve, que es lo que en un editor con
 * áreas hace el selector de tipo: el resto de la pantalla siempre enseña lo
 * mismo, y lo que cambia es el reparto.
 */
const EDITORES: readonly Editor[] = [
  { id: 'mastil', name: 'Mástil', Icono: IconoMastil, render: FretboardPanel, entero: true },
  { id: 'grabar', name: 'Grabar', Icono: IconoPunto, render: Grabadora, entero: true },
  { id: 'ideas', name: 'Ideas', Icono: IconoIdeas, render: IdeasPanel },
  // Salidas al lado de Ideas porque las dos preguntan al modelo, y las dos
  // cuestan una petición del cupo: tenerlas juntas dice sin decirlo cuáles son
  // las que gastan.
  { id: 'salidas', name: 'Salidas', Icono: IconoSalidas, render: VersionsPanel },
  // Canciones antes que Sesiones porque no son lo mismo y se confunden: una
  // canción se guarda a propósito y con nombre, y una sesión es el rastro de lo
  // que se tocó. Lo que se busca a menudo va primero.
  { id: 'canciones', name: 'Canciones', Icono: IconoCanciones, render: SongsPanel },
  { id: 'sesiones', name: 'Sesiones', Icono: IconoSesiones, render: SessionsPanel },
];

/**
 * Los espacios de trabajo: **tres maneras de escribir la misma canción**.
 *
 * `Tocando` va primero porque es por donde se empieza y porque es la que estaba
 * construida y escondida
 * ([adr/0034](../../../docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
 * No son vistas distintas de la canción: son entradas distintas a la misma.
 */
const ESPACIOS = [
  { id: 'tocando', name: 'Tocando', Icono: IconoMicro },
  { id: 'escribir', name: 'Escribir', Icono: IconoComponer },
  { id: 'ensayar', name: 'Ensayar', Icono: IconoTocar },
] as const;

/**
 * Componer: un banco de trabajo de cuatro áreas.
 *
 * **Una sola pantalla repartida, y no dos caras con un conmutador.** Lo segundo
 * es lo que había, y existía por un motivo que este mismo fichero documentaba:
 * «no hay reparto bueno en un portátil, son cinco franjas peleando por el mismo
 * alto». Deja de ser cierto cuando el reparto lo mueve quien mira
 * ([adr/0031](../../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)), y a
 * cambio se acaba el salto que había que dar para ver un acorde mientras
 * escribes la canción: las dos preguntas de componer —qué acorde tengo delante y
 * cómo va mi canción— no son sucesivas, son simultáneas.
 *
 * Cuatro áreas y una regla para cada una:
 *
 * - **Izquierda: lo que decides.** La rueda, la escala, el estilo y la
 *   afinación. Se elige una vez y no se vuelve.
 * - **Centro: lo que haces.** El arreglo arriba y, debajo, a dónde puedes ir
 *   desde el acorde que tienes. Es lo único que crece cuando crece la pantalla.
 * - **Derecha: lo que hay seleccionado.** El acorde con sus formas, y lo que se
 *   está oyendo.
 * - **Abajo: un área con selector de tipo.** Mástil, grabar, ideas, salidas,
 *   canciones o sesiones.
 *
 * **Y por debajo de `lg` no hay banco de trabajo**, y no se disimula: las áreas
 * se apilan en una columna. Divisores que se arrastran con el dedo es lo que
 * convierte un editor en una pelea.
 */
export function ComposeScreen() {
  // El montaje se escribe en grados, y los grados no se llaman igual en mayor
  // que en menor: sin esto, cambiar de tonalidad con la canción empezada tumba
  // la pantalla entera. Vive en `state/` porque son dos almacenes hablándose.
  useMontajeEnSuModo();
  const activeKey = useSessionStore(selectActiveKey);
  const accionesDeSesion = useSessionStore((state) => state.actions);

  // Por porciones y no el objeto entero: el motor entrega veinte lecturas por
  // segundo y esta pantalla no puede repintarse veinte veces por segundo.
  const izquierda = useBancoStore((state) => state.izquierda);
  const derecha = useBancoStore((state) => state.derecha);
  const alto = useBancoStore((state) => state.alto);
  const abajo = useBancoStore((state) => state.abajo);
  const espacio = useBancoStore((state) => state.espacio);
  const accionesDelBanco = useBancoStore((state) => state.actions);

  // El reparto guardado se recupera después de pintar, como el tema: leerlo
  // durante el render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    accionesDelBanco.cargar();
  }, [accionesDelBanco]);

  const editor = EDITORES.find((candidato) => candidato.id === abajo) ?? null;

  /**
   * Ir a la escala que propone una idea.
   *
   * Las dos cosas y en este orden: ponerla, y abrir el mástil, que es donde una
   * escala se ve. Ponerla y quedarse en Ideas dejaría el cambio sin enseñar, y
   * abrir el mástil sin ponerla enseñaría la que ya había.
   *
   * Vive aquí y no en `features/ideas` porque cambiar de área abierta es cosa de
   * esta pantalla, y un feature no importa de otro.
   */
  function irALaEscala(scaleId: ScaleId): void {
    accionesDeSesion.setScale(scaleId);
    accionesDelBanco.abrirAbajo('mastil');
  }

  /**
   * Componer cuenta como practicar, y esta es la única pantalla que lo escucha.
   *
   * `escuchaComponer` va encendido aquí y en ningún sitio más: cada llamada a
   * `useProgress` tiene su propia copia del avance, así que dos apuntados
   * sumarían dos veces el mismo hecho y se pisarían al guardar.
   */
  const { composeGain, dismissComposeGain } = useProgress({ escuchaComponer: true });

  // Los anchos viajan como variables CSS y no como `style` en cada área: así el
  // mismo árbol sirve para el banco y para la columna apilada, y es Tailwind
  // quien decide cuál manda con su punto de corte. Con un `style` por columna
  // habría que pintar dos árboles y montar dos veces lo que hay dentro.
  const reparto = {
    '--banco-izquierda': `${izquierda}rem`,
    '--banco-derecha': `${derecha}rem`,
    '--banco-alto': `${alto}rem`,
  } as CSSProperties;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader
        title="Componer"
        lead={
          espacio === 'tocando'
            ? 'Toca, y lo que suena se escribe solo.'
            : 'Escribe la canción, mírala acorde a acorde y escúchala.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* Los espacios de trabajo antes que el metrónomo: son lo que cambia
                la pantalla entera, y lo que cambia más cosas va primero. */}
            <span className="flex gap-1" role="group" aria-label="Espacio de trabajo">
              {ESPACIOS.map((candidato) => (
                <Chip
                  key={candidato.id}
                  onClick={() => accionesDelBanco.espacio(candidato.id)}
                  pressed={espacio === candidato.id}
                  tone="quiet"
                  className="px-3 text-xs"
                >
                  <candidato.Icono />
                  {candidato.name}
                </Chip>
              ))}
            </span>
            <Metronome />
          </div>
        }
      />

      {/* Se ofrece la última sesión, no se pone. Desaparece sola en cuanto
          eliges tonalidad o tocas algo. */}
      <ResumeLast />

      {/* En estrecho la tonalidad se pliega a una línea: la rueda ocupa media
          pantalla de teléfono y es justo lo que se toca una vez al empezar. En
          el banco vive en su área y esta barra no existe. */}
      <div className="border-border bg-surface shrink-0 border-b px-3 lg:hidden">
        <BarraDeTonalidad>
          <Settings />
        </BarraDeTonalidad>
      </div>

      {/* Apilado se desplaza y en el banco no: abajo de `lg` las áreas van una
          debajo de otra y en una ventana baja no caben, así que quien se
          desplaza es esta caja. En el banco cada área se apaña con su hueco, que
          es de lo que va un banco de trabajo. */}
      <div
        className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
        style={reparto}
      >
        <Area
          titulo="Tonalidad"
          icono={<IconoAfinar />}
          className="border-border hidden lg:flex lg:w-[var(--banco-izquierda)] lg:shrink-0 lg:border-r"
        >
          <div className="flex flex-col items-center gap-2 p-3 [&>*]:shrink-0">
            <KeyPanel compact />
            <p className="text-text-muted text-center text-xs">
              {activeKey === null
                ? 'Pulsa una tonalidad para empezar'
                : keyName(activeKey.tonic, activeKey.mode)}
            </p>
            <Settings />
          </div>
        </Area>

        <Divisor
          orientacion="vertical"
          valor={izquierda}
          min={TOPES_DEL_BANCO.izquierda.min}
          max={TOPES_DEL_BANCO.izquierda.max}
          etiqueta="Ancho de la tonalidad"
          onCambio={(rem) => accionesDelBanco.mover('izquierda', rem)}
          onDevolver={() => accionesDelBanco.devolver('izquierda')}
          className="hidden lg:block"
        />

        {/* El centro: lo único que crece cuando crece la pantalla. */}
        <div className="flex min-h-0 grow flex-col">
          <Area
            titulo={espacio === 'tocando' ? 'Tocando' : 'Arreglo'}
            icono={espacio === 'tocando' ? <IconoMicro /> : <IconoComponer />}
            scroll={false}
            // Suelo, porque es lo único que no se desplaza por dentro: lo que
            // no le quepa al lienzo se recorta y deja su barra sin alcanzar.
            className="grow lg:min-h-56"
          >
            {activeKey === null ? (
              // `my-auto` en el hijo y no `justify-center` aquí, que es la regla
              // de la casa: centrar en la caja que se desplaza saca lo que no
              // cabe por los dos lados y deja la mitad de arriba fuera de
              // alcance.
              <div className="flex h-full min-h-0 flex-col overflow-y-auto">
                <div className="my-auto">
                  <EmpezarPorTonalidad />
                </div>
              </div>
            ) : espacio === 'tocando' ? (
              <TocarParaEscribir onEscrito={() => accionesDelBanco.espacio('escribir')} />
            ) : (
              <ArrangeCanvas />
            )}
          </Area>

          {/* A dónde ir, debajo del arreglo y a lo ancho del centro: es lo que se
              mira **mientras** se escribe, no una consulta aparte. De alto fijo y
              con su propio desplazamiento, para que la lista no le robe sitio a
              la canción por venir larga. */}
          {activeKey !== null && (
            <Area
              titulo="A dónde ir"
              icono={<IconoTocar />}
              // Pide trece rem, pero **cede**: al abrir el área de abajo el alto
              // no da para todos, y lo que no puede encogerse es el arreglo.
              // Esta lista se desplaza por dentro, así que perder altura aquí no
              // esconde nada; plantarse dejaba el lienzo en setenta píxeles y su
              // barra fuera de alcance.
              className="border-border min-h-16 shrink basis-52 border-t"
            >
              <NextChords />
            </Area>
          )}
        </div>

        <Divisor
          orientacion="vertical"
          valor={derecha}
          min={TOPES_DEL_BANCO.derecha.min}
          max={TOPES_DEL_BANCO.derecha.max}
          sentido={-1}
          etiqueta="Ancho del acorde"
          onCambio={(rem) => accionesDelBanco.mover('derecha', rem)}
          onDevolver={() => accionesDelBanco.devolver('derecha')}
          className="hidden lg:block"
        />

        {activeKey !== null && (
          <Area
            titulo="Acorde"
            icono={<IconoMastil />}
            className="border-border border-t lg:w-[var(--banco-derecha)] lg:shrink-0 lg:border-t-0 lg:border-l"
          >
            {/* Arriba lo que has elegido tú, abajo lo que estás tocando. Cada
                cosa tiene su sitio fijo, así que al soltar las cuerdas nada se
                mueve: solo cambia el rótulo de «Suena» a «Último». */}
            <CurrentChord />
            <Voicings />
            <HeardChord />
          </Area>
        )}
      </div>

      {editor !== null && (
        <Divisor
          orientacion="horizontal"
          valor={alto}
          min={TOPES_DEL_BANCO.alto.min}
          max={TOPES_DEL_BANCO.alto.max}
          sentido={-1}
          etiqueta={`Alto de ${editor.name}`}
          onCambio={(rem) => accionesDelBanco.mover('alto', rem)}
          onDevolver={() => accionesDelBanco.devolver('alto')}
          className="hidden lg:block"
        />
      )}

      {editor !== null && (
        <Area
          titulo={editor.name}
          icono={<editor.Icono />}
          scroll={editor.entero !== true}
          // El tope en `vh` manda sobre el alto guardado: en una pantalla baja,
          // dieciséis rem guardados en un monitor grande dejan el arreglo sin
          // sitio, y el reparto se guarda en rem a propósito.
          // **También cede**, y por eso no es `shrink-0`: con el alto guardado
          // en un monitor grande, abrirla en un portátil dejaba al arreglo por
          // debajo de su suelo y lo de dentro sin alcanzar. Lo que hay aquí
          // sabe encogerse —el mástil se ajusta a su caja, lo demás se
          // desplaza—, así que ceder no esconde nada.
          className="border-border max-h-[60vh] min-h-32 shrink border-t lg:h-[var(--banco-alto)] lg:max-h-[42vh]"
          mandos={
            <button
              type="button"
              onClick={() => accionesDelBanco.abrirAbajo(null)}
              aria-label={`Cerrar ${editor.name}`}
              title="Cerrar"
              className="text-text-muted hover:text-oxblood-bright inline-flex cursor-pointer items-center px-1"
            >
              <IconoCerrar />
            </button>
          }
        >
          {/* El relleno del área, y **parte del reparto**: como bloque suelto se
              quedaba con su alto natural dentro de una caja más baja, y lo que
              llevaba dentro —el mástil— se salía por abajo sin manera de
              alcanzarlo. */}
          <div className="flex min-h-0 grow flex-col p-3">
            {/* Ideas es la única que necesita algo de la pantalla: llevarte a la
                escala que propone. Se le pasa aquí y no por la tabla de arriba
                porque los otros cinco ya traen sus propias props y no hay un tipo
                común que valga para los seis sin mentir. */}
            {editor.id === 'ideas' ? <IdeasPanel onIrALaEscala={irALaEscala} /> : <editor.render />}
          </div>
        </Area>
      )}

      {/* La fila se desplaza a lo ancho y no se parte en dos: seis pastillas
          envueltas dejaban la barra a dos alturas justo donde menos alto hay. */}
      <section
        aria-label="Qué se ve abajo"
        className="border-border relative flex shrink-0 flex-col border-t"
      >
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {EDITORES.map((candidato) => (
            <Chip
              key={candidato.id}
              onClick={() => accionesDelBanco.abrirAbajo(candidato.id)}
              pressed={abajo === candidato.id}
              tone="quiet"
              className="shrink-0 text-xs"
            >
              <candidato.Icono />
              {candidato.name}
            </Chip>
          ))}
        </div>

        {/* Dentro de la barra, que es la caja `relative` de esta pantalla, y
            saliendo hacia arriba desde ella: así queda por encima de todo sin que
            nadie tenga que adivinar cuánto mide. No empuja nada: flota. */}
        <GananciaAlComponer gain={composeGain} onDismiss={dismissComposeGain} />
      </section>
    </div>
  );
}
