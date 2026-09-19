'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

import { keyName, type DegreeSymbol, type EspecieDeBloque, type ScaleId } from '@core/music';
import { ArrangeCanvas, Ensayo, TocarParaEscribir } from '@features/arrange';
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
import { ATAJOS, useAtajosDelBanco } from '@state/atajos-del-banco';
import { useArrangementStore } from '@state/arrangement-store';
import { selectPlegada, selectReparto, useBancoStore, type EditorDeAbajo } from '@state/banco';
import { useMontajeEnSuModo } from '@state/montaje-en-su-modo';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { TOPES_DEL_BANCO } from '@state/workspace';
import { Area } from '@ui/Area';
import { Chip } from '@ui/Chip';
import { Divisor } from '@ui/Divisor';
import { CuatroTonalidades, EmpezarPorTonalidad } from '@ui/EmpezarPorTonalidad';
import { CupoDeIA } from '@ui/CupoDeIA';
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
import { useHayBanco } from '@ui/use-hay-banco';

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
  { id: 'tocando', name: 'Tocando', Icono: IconoMicro, atajo: ATAJOS.tocando },
  { id: 'escribir', name: 'Escribir', Icono: IconoComponer, atajo: ATAJOS.escribir },
  { id: 'ensayar', name: 'Ensayar', Icono: IconoTocar, atajo: ATAJOS.ensayar },
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
  const espacio = useBancoStore((state) => state.espacio);
  const reparto = useBancoStore(selectReparto);
  const { izquierda, derecha, alto, abajo } = reparto;
  const plegadaIzquierda = useBancoStore(selectPlegada('izquierda'));
  const plegadaDerecha = useBancoStore(selectPlegada('derecha'));
  const plegadoElCamino = useBancoStore(selectPlegada('camino'));
  const accionesDelBanco = useBancoStore((state) => state.actions);

  /**
   * Por debajo de `lg` no hay banco: **una sola área a la vez, con pestañas**.
   *
   * No es el mismo árbol con otro reparto. Apiladas, las tres áreas dejaban la
   * canción en una rendija y el inspector del acorde llevándose media pantalla;
   * y plegar, que arriba es un gesto útil, ahí solo añade tiras que ocupan sin
   * enseñar nada. Se elige con el pulgar, como el resto de la aplicación en
   * pantalla estrecha.
   */
  const hayBanco = useHayBanco();
  /*
    Plegada **solo donde hay banco**, y las dos cosas con la misma cuenta.

    El plegado es del banco: por debajo de `lg` no hay áreas que repartir, hay
    una pestaña que enseña una sola. `plegada` ya lo descontaba y el `className`
    no, así que apilada el área se quedaba además sin su alto.
  */
  const caminoPlegado = hayBanco && plegadoElCamino;
  const [areaMovil, setAreaMovil] = useState<'arreglo' | 'camino' | 'acorde'>('arreglo');

  /**
   * Si la barra de tonalidad está abierta tapando la pantalla.
   *
   * Solo existe por debajo de `lg`, y ahí abierta ocupa de la barra al final de
   * la pantalla: el estado vacío de componer y la barra de herramientas de abajo
   * quedan **enteros detrás**. Verlos no se ve nada, pero seguían recibiendo el
   * foco —doce paradas seguidas del tabulador sobre controles invisibles, medido
   * en un teléfono— y anunciándose, con lo que un lector de pantalla leía dos
   * veces las mismas cuatro tonalidades: las del panel y las de debajo.
   *
   * El valor de salida se calcula igual que lo calcula la barra, porque un
   * `<details>` que nace abierto no dispara `toggle`; a partir de ahí manda ella.
   */
  const [tonalidadAbierta, setTonalidadAbierta] = useState(activeKey === null);
  const tapadoPorLaRueda = !hayBanco && tonalidadAbierta;

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
  useAtajosDelBanco(hayBanco);

  /**
   * Poner un acorde al final de la canción.
   *
   * Lo comparten «a dónde ir» y lo que oye el micro, que son los dos sitios
   * desde los que se pone un acorde sin arrastrarlo
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   * Sin partes todavía se crea una: poner el primer acorde es lo que crea la
   * primera parte en todo el resto de la pantalla.
   */
  const ponerEnLaCancion = useCallback((degree: DegreeSymbol, especie?: EspecieDeBloque) => {
    const acciones = useArrangementStore.getState().actions;
    const montaje = useArrangementStore.getState().arrangement;
    const parte = montaje.parts.at(-1)?.id ?? acciones.addPart('Estrofa');
    const pulsos = useSessionStore.getState().beatsPerBar;
    acciones.elegirBloque(acciones.addBlock(parte, degree, pulsos, null, especie));
  }, []);

  // Los anchos viajan como variables CSS y no como `style` en cada área: así el
  // mismo árbol sirve para el banco y para la columna apilada, y es Tailwind
  // quien decide cuál manda con su punto de corte. Con un `style` por columna
  // habría que pintar dos árboles y montar dos veces lo que hay dentro.
  const medidas = {
    '--banco-izquierda': `${izquierda}rem`,
    '--banco-derecha': `${derecha}rem`,
    '--banco-alto': `${alto}rem`,
  } as CSSProperties;

  return (
    // Las medidas van aquí y no en la fila del banco: el área de abajo es
    // **hermana** de esa fila, no hija, así que allí no heredaba
    // `--banco-alto` y se quedaba con el alto que le sobrara. El mástil, que se
    // ajusta a su caja, salía entonces del tamaño de un sello.
    <div className="flex h-full min-h-0 flex-col" style={medidas}>
      <WorkHeader
        title="Componer"
        lead={
          espacio === 'tocando'
            ? 'Toca, y lo que suena se escribe solo.'
            : espacio === 'ensayar'
              ? 'Tócala contra el metrónomo, y te digo cómo ha ido.'
              : 'Escribe la canción, mírala acorde a acorde y escúchala.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* Los espacios de trabajo antes que el metrónomo: son lo que cambia
                la pantalla entera, y lo que cambia más cosas va primero. */}
            {/* Envuelve, porque son tres y en un teléfono de 320 no caben en una
                línea al lado del metrónomo: sin esto el tercero se iba por la
                derecha y el marco recorta, así que «Ensayar» dejaba de existir. */}
            <span className="flex flex-wrap gap-1" role="group" aria-label="Espacio de trabajo">
              {ESPACIOS.map((candidato) => (
                <Chip
                  key={candidato.id}
                  onClick={() => accionesDelBanco.espacio(candidato.id)}
                  pressed={espacio === candidato.id}
                  tone="quiet"
                  ariaLabel={candidato.name}
                  atajo={candidato.atajo}
                  className="px-2 text-xs sm:px-3"
                >
                  <candidato.Icono />
                  {/* En un teléfono, solo el icono. Con los tres rótulos la fila
                      se parte en dos, y de la altura de esta cabecera cuelga la
                      del panel de la rueda: al crecer una fila, la rueda dejaba
                      de caber y se salía por abajo sin manera de alcanzarla. */}
                  <span className="hidden sm:inline">{candidato.name}</span>
                </Chip>
              ))}
            </span>
            <Metronome />

            {/* La salida para quien se lo ha dejado imposible. Un banco que se
                mueve necesita una manera de volver, o plegar y arrastrar dan
                miedo; y como el reparto es de este espacio, devolverlo no toca
                los otros dos. */}
            {/* Lo que queda de IA, a la vista antes de gastarlo: estaba solo
                dentro del panel que lo gasta, así que para saberlo había que
                abrir el que ibas a usar
                ([adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)). */}
            <CupoDeIA className="px-2" />

            <button
              type="button"
              onClick={() => accionesDelBanco.devolverElReparto()}
              className="text-text-muted hover:text-brass-bright min-h-tap hidden cursor-pointer items-center px-2 text-xs lg:inline-flex"
              title={`Devolver las áreas a como venían en este espacio · ${ATAJOS.devolver}`}
              aria-keyshortcuts={ATAJOS.devolver}
            >
              Reordenar
            </button>
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
        <BarraDeTonalidad onAbrirse={setTonalidadAbierta}>
          {/*
            Sin tonalidad, aquí van las cuatro de salida; con ella, los ajustes.

            No es por sitio, es que **lo de debajo no se ve**: esta barra flota
            sobre la pantalla y se abre ella sola mientras no hay tonalidad, así
            que en un teléfono el estado vacío de componer —con sus cuatro
            botones y el micro— quedaba entero detrás del panel. Los atajos para
            quien no sabe cuál elegir eran justo lo inalcanzable.

            Y se turnan en vez de apilarse porque el panel no cabe con las dos
            cosas: el estilo y la escala no deciden nada hasta que hay una
            tonalidad sobre la que suenen.
          */}
          {activeKey === null ? (
            <CuatroTonalidades>Empieza por una:</CuatroTonalidades>
          ) : (
            <Settings />
          )}
        </BarraDeTonalidad>
      </div>

      {/* Las pestañas de las áreas, solo en estrecho y solo con tonalidad: sin
          ella la pantalla dice una sola cosa y no hay entre qué elegir. Con las
          áreas apiladas, la canción quedaba en una rendija; aquí se ve una a la
          vez y entera. */}
      {!hayBanco && activeKey !== null && (
        <div
          role="group"
          aria-label="Qué se ve"
          className="border-border bg-surface flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-1"
        >
          {(
            [
              [
                'arreglo',
                espacio === 'tocando' ? 'Tocando' : espacio === 'ensayar' ? 'Ensayo' : 'Arreglo',
              ],
              ['camino', 'A dónde ir'],
              ['acorde', 'Acorde'],
            ] as const
          ).map(([id, nombre]) => (
            <Chip
              key={id}
              onClick={() => setAreaMovil(id)}
              pressed={areaMovil === id}
              tone="quiet"
              className="shrink-0 px-3 text-xs"
            >
              {nombre}
            </Chip>
          ))}
        </div>
      )}

      {/* Apilado se desplaza y en el banco no: abajo de `lg` las áreas van una
          debajo de otra y en una ventana baja no caben, así que quien se
          desplaza es esta caja. En el banco cada área se apaña con su hueco, que
          es de lo que va un banco de trabajo. */}
      <div
        className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
        inert={tapadoPorLaRueda}
      >
        <Area
          titulo="Tonalidad"
          icono={<IconoAfinar />}
          plegada={plegadaIzquierda}
          onPlegar={() => accionesDelBanco.plegar('izquierda')}
          atajo={ATAJOS.izquierda}
          className={`border-border hidden lg:flex lg:shrink-0 lg:border-r ${
            plegadaIzquierda ? '' : 'lg:w-[var(--banco-izquierda)]'
          }`}
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

        {/* El divisor solo existe si hay algo que repartir: plegada, el área es
            una tira fija y arrastrarla no significaría nada. */}
        {!plegadaIzquierda && (
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
        )}

        {/* El centro: lo único que crece cuando crece la pantalla.

            `min-w-0` no es decoración. Un hijo de `flex` tiene `min-width: auto`,
            que es el ancho de su contenido, y aquí dentro hay una barra larga
            —«Escuchar la canción», las vistas, «Traer lo grabado», las figuras,
            «Deshacer»—. Sin esto, el centro se planta en lo que mide esa barra y
            **empuja la columna del acorde fuera de la pantalla**: el área se
            queda en ciento sesenta píxeles y su texto sale cortado por el borde
            derecho. Se vio en una captura, no midiendo: la medida solo lo enseña
            cuando la barra está en su versión larga. */}
        {/*
          Esta caja lleva **dos** áreas dentro —el arreglo y «a dónde ir»—, y
          apilada se enseña de una en una con pestañas.

          Miraba solo la del arreglo, así que al elegir «A dónde ir» se escondía
          la caja entera y con ella el área que se acababa de pedir: en un
          teléfono, la pestaña dejaba **una pantalla en negro**. Medido: la
          región existía, con su lista dentro, en una caja de 0×0.
        */}
        <div
          className={`flex min-h-0 min-w-0 grow flex-col ${
            hayBanco || areaMovil === 'arreglo' || areaMovil === 'camino' ? '' : 'hidden'
          }`}
        >
          <Area
            titulo={
              espacio === 'tocando' ? 'Tocando' : espacio === 'ensayar' ? 'Ensayo' : 'Arreglo'
            }
            icono={
              espacio === 'tocando' ? (
                <IconoMicro />
              ) : espacio === 'ensayar' ? (
                <IconoTocar />
              ) : (
                <IconoComponer />
              )
            }
            scroll={false}
            sinCabecera={!hayBanco}
            // Suelo, porque es lo único que no se desplaza por dentro: lo que
            // no le quepa al lienzo se recorta y deja su barra sin alcanzar.
            // Diez rem en el banco —es lo que deja sitio al área de abajo para
            // que el mástil se lea—, y **veintiséis apiladas**: ahí el alto no
            // lo reparte nadie, cada área toma el suyo, y sin suelo el arreglo
            // se quedaba en una rendija con la partitura cortada mientras el
            // acorde de debajo se llevaba media pantalla.
            // Suelo también apilado: con pestañas solo se ve un área, así que
            // puede pedir alto, y quien se desplaza es la columna. Sin él, el
            // lienzo se quedaba en ochenta píxeles con su barra fuera.
            className={`min-h-[26rem] grow lg:min-h-40 ${
              hayBanco || areaMovil === 'arreglo' ? '' : 'hidden'
            }`}
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
            ) : espacio === 'ensayar' ? (
              <Ensayo />
            ) : (
              <ArrangeCanvas />
            )}
          </Area>

          {/* A dónde ir, debajo del arreglo y a lo ancho del centro: es lo que se
              mira **mientras** se escribe, no una consulta aparte. De alto fijo y
              con su propio desplazamiento, para que la lista no le robe sitio a
              la canción por venir larga. */}
          {activeKey !== null && (hayBanco || areaMovil === 'camino') && (
            <Area
              titulo="A dónde ir"
              icono={<IconoTocar />}
              plegada={caminoPlegado}
              onPlegar={hayBanco ? () => accionesDelBanco.plegar('camino') : undefined}
              pliegue="horizontal"
              sinCabecera={!hayBanco}
              /*
                Pide trece rem, pero **cede**: al abrir el área de abajo el alto
                no da para todos, y lo que no puede encogerse es el arreglo. Esta
                lista se desplaza por dentro, así que perder altura aquí no
                esconde nada; plantarse dejaba el lienzo en setenta píxeles y su
                barra fuera de alcance.

                **Pero hasta un suelo, y el suelo no era suelo.** Estaba en 64 px,
                menos de lo que mide su propia cabecera —el buscador y la fila de
                «Desde G» con sus leyendas ocupan 73—, así que a la lista le
                quedaba lo que sobrase: medido, 59 px en una ventana de 900 de
                alto, 36 en una de 800 y **16 en una de 700**, cuando una sola
                tarjeta mide 72. Se abría un cajón donde no cabía ni una fila, y
                la primera salía partida por el borde.

                Con sitio se planta en once rem —cabecera más una tarjeta— y en
                quince si la ventana pasa de 860, que es donde el lienzo va
                sobrado. Sin sitio —una ventana de 600 de alto— vuelve a ceder,
                porque ahí plantarse es lo que deja la barra del lienzo fuera de
                alcance: comprobado con la sonda, cuatro elementos inalcanzables.

                Y apilada ocupa lo que le dejen: es la única área a la vista, así
                que quedarse en trece rem dejaba media pantalla en negro debajo de
                una sola propuesta.
              */
              className={
                caminoPlegado
                  ? ''
                  : 'border-border shrink basis-52 border-t max-lg:grow [@media(min-height:660px)]:min-h-44 [@media(min-height:860px)]:min-h-60'
              }
            >
              {/* Lo que cabe en un bloque entra en la canción, al final de la
                  última parte, que es donde encaja una propuesta
                  ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
                  Sin partes todavía se crea una: poner el primer acorde es lo
                  que crea la primera parte en todo el resto de la pantalla. */}
              <NextChords onPoner={ponerEnLaCancion} />
            </Area>
          )}
        </div>

        {!plegadaDerecha && activeKey !== null && (
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
        )}

        {activeKey !== null && (hayBanco || areaMovil === 'acorde') && (
          <Area
            titulo="Acorde"
            icono={<IconoMastil />}
            plegada={hayBanco && plegadaDerecha}
            onPlegar={hayBanco ? () => accionesDelBanco.plegar('derecha') : undefined}
            atajo={hayBanco ? ATAJOS.derecha : undefined}
            sinCabecera={!hayBanco}
            // Apilada tiene tope: es una consulta, no el trabajo, y sin él se
            // llevaba más alto que la propia canción.
            className={`border-border border-t max-lg:grow lg:shrink-0 lg:border-t-0 lg:border-l ${
              hayBanco && plegadaDerecha ? '' : 'lg:w-[var(--banco-derecha)]'
            }`}
          >
            {/* Arriba lo que has elegido tú, abajo lo que estás tocando. Cada
                cosa tiene su sitio fijo, así que al soltar las cuerdas nada se
                mueve: solo cambia el rótulo de «Suena» a «Último». */}
            <CurrentChord />
            <Voicings />
            {/* Y lo que se oye también entra en la canción, no en el camino:
                tocar un acorde y quedárselo es componer. */}
            <HeardChord onPoner={ponerEnLaCancion} />
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

      {/*
        El aviso de lo ganado, anclado **encima del editor y de la barra**, no
        solo de la barra.

        Estaba dentro de la barra de herramientas y salía hacia arriba desde
        ella, que es lo correcto con el área de abajo cerrada. Con un editor
        abierto, «encima de la barra» **es dentro del editor**: al guardar una
        canción el aviso caía justo sobre su fila y tapaba «Renombrar» y
        «Borrar» durante los cuatro segundos en que se está mirando eso.

        Envolviendo los dos, sale por encima del que esté arriba sin que nadie
        tenga que adivinar cuánto miden. Sigue sin empujar nada: flota.
      */}
      <div className="relative flex min-h-0 shrink-0 flex-col" inert={tapadoPorLaRueda}>
        <GananciaAlComponer gain={composeGain} onDismiss={dismissComposeGain} />

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
            // **Conserva su alto, y el que cede es el centro.** Cediendo ella, el
            // mástil se quedaba en un dibujo de cien píxeles con media franja
            // vacía a los lados: se ajusta a su caja, así que una caja aplastada
            // da un mástil ilegible. Es lo que este proyecto ya había decidido
            // —«perder la mitad de la pantalla mientras está abierto es un precio
            // que se paga solo mientras se mira»—, y el tope en `vh` impide que en
            // una pantalla baja se lo lleve todo.
            className="border-border max-h-[60vh] shrink-0 border-t lg:h-[var(--banco-alto)] lg:max-h-[42vh]"
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
              {editor.id === 'ideas' ? (
                <IdeasPanel onIrALaEscala={irALaEscala} />
              ) : (
                <editor.render />
              )}
            </div>
          </Area>
        )}

        {/* La fila se desplaza a lo ancho y no se parte en dos: seis pastillas
          envueltas dejaban la barra a dos alturas justo donde menos alto hay. */}
        <section
          aria-label="Qué se ve abajo"
          className="border-border flex shrink-0 flex-col border-t"
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
        </section>
      </div>
    </div>
  );
}
