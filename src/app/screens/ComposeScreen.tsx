'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useState,
  type ComponentType,
  type CSSProperties,
  type LazyExoticComponent,
} from 'react';

import { keyName, type DegreeSymbol, type EspecieDeBloque } from '@core/music';
// Del módulo y no del índice: `@features/arrange` reexporta también el lienzo y
// el ensayo, que van en diferido, y un índice es la manera más corta de volver a
// traérselos al paquete de entrada sin que nadie lo note (adr/0045, adr/0058).
import { TocarParaEscribir } from '@features/arrange/TocarParaEscribir';
// Del módulo y no del índice: el índice de `learn` reexporta el camino entero, y
// con él viajaba el temario a una pantalla que no enseña ninguna unidad
// (adr/0058).
import { GananciaAlComponer } from '@features/learn/GananciaAlComponer';
import { useGananciaAlComponer } from '@features/learn/use-ganancia-al-componer';
import { Metronome } from '@features/metronome';
import { CurrentChord, HeardChord, NextChords, Voicings } from '@features/path';
import { ResumeLast } from '@features/sessions/ResumeLast';
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
  IconoMastil,
  IconoMicro,
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
  readonly render: ComponentType;
  /** Trae su código antes de pedirlo, al pasar por su pastilla. */
  readonly precargar: () => void;
  /**
   * Si lo de dentro se dibuja entero o hay que desplazarlo. El mástil se dibuja
   * entero y no hace scroll nunca; lo demás es texto, y el texto se lee
   * desplazándolo.
   */
  readonly entero?: boolean;
  /**
   * Si su alto lo decide su propia proporción, y no el divisor.
   *
   * Solo el mástil. **Un dibujo de proporción fija no tiene un alto que
   * repartir: tiene uno**, el que llena el ancho que le toque, y cualquier otro
   * deja franjas muertas. Arrastrar el divisor ahí no reparte nada
   * ([adr/0037](../../../docs/adr/0037-el-mastil-pide-su-alto.md)).
   */
  readonly aSuProporcion?: boolean;
  /**
   * Lo que este panel quiera decir **en la cabecera del área**, al lado de su
   * nombre.
   *
   * Existe por el mástil: sus dos rótulos vivían encima del dibujo y costaban
   * 45 píxeles, que son justo los que le faltaban para llenar el ancho de un
   * monitor grande ([adr/0038](../../../docs/adr/0038-doce-trastes-que-se-vean.md)).
   * La cabecera ya estaba, y estaba vacía.
   */
  readonly rotulos?: ComponentType;
}

/**
 * **Lo que no se ve al entrar llega después** ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md)).
 *
 * Se entra por `Tocando` con el área de abajo cerrada, así que el lienzo, el
 * ensayo, el mástil y los tres paneles de abajo no se pintan en la primera
 * visita, y los seis se descargaban con ella: `/componer` bajaba 259 KB sin
 * dividir. Cada uno es aquí una promesa de su módulo —del módulo y no del
 * índice, por lo mismo que las pantallas (adr/0045)— y pedir la misma dos veces
 * no descarga nada: el empaquetador guarda lo que ya trajo.
 */
const CARGAS = {
  lienzo: () => import('@features/arrange/ArrangeCanvas'),
  ensayo: () => import('@features/arrange/Ensayo'),
  mastil: () => import('@features/fretboard/FretboardPanel'),
  salidas: () => import('@features/versions/VersionsPanel'),
  canciones: () => import('@features/songs/SongsPanel'),
  sesiones: () => import('@features/sessions/SessionsPanel'),
} as const;

function precargar(...cuales: ReadonlyArray<keyof typeof CARGAS>): void {
  for (const cual of cuales) {
    void CARGAS[cual]();
  }
}

/**
 * `React.lazy` sobre una exportación con nombre.
 *
 * Con `lazy` y `Suspense` de React y no con `next/dynamic`, que es lo mismo por
 * dentro: `next/dynamic` solo es el de producción después de que el compilador
 * de Next lo reescriba, y en Vitest se resuelve a la versión del Pages Router
 * —otro cargador—, así que los tests probarían una pieza que no es la que se
 * sirve (adr/0058).
 */
function diferido<K extends string, M extends Record<K, ComponentType>>(
  cargar: () => Promise<M>,
  nombre: K,
): LazyExoticComponent<M[K]> {
  return lazy(() => cargar().then((modulo) => ({ default: modulo[nombre] })));
}

const ArrangeCanvas = diferido(CARGAS.lienzo, 'ArrangeCanvas');
const Ensayo = diferido(CARGAS.ensayo, 'Ensayo');
const FretboardPanel = diferido(CARGAS.mastil, 'FretboardPanel');
const RotulosDelMastil = diferido(CARGAS.mastil, 'RotulosDelMastil');
const VersionsPanel = diferido(CARGAS.salidas, 'VersionsPanel');
const SongsPanel = diferido(CARGAS.canciones, 'SongsPanel');
const SessionsPanel = diferido(CARGAS.sesiones, 'SessionsPanel');

/**
 * Lo que ocupa el sitio mientras llega el código.
 *
 * Casi nunca se ve: el lienzo y el ensayo se piden en cuanto la pantalla se
 * queda quieta, y los de abajo al pasar por su pastilla. Pero cuando se ve —una
 * red lenta, un atajo de teclado nada más entrar— dice qué viene, en vez de un
 * hueco que parece un fallo.
 */
function Abriendo({ que }: { readonly que: string }) {
  return (
    <p role="status" className="text-text-muted m-auto p-6 text-center text-sm">
      Abriendo {que}…
    </p>
  );
}

/**
 * Los editores que caben en el área de abajo.
 *
 * Es el único sitio donde se elige **qué** se ve, que es lo que en un editor con
 * áreas hace el selector de tipo: el resto de la pantalla siempre enseña lo
 * mismo, y lo que cambia es el reparto.
 */
const EDITORES: readonly Editor[] = [
  {
    id: 'mastil',
    name: 'Mástil',
    Icono: IconoMastil,
    render: FretboardPanel,
    precargar: () => precargar('mastil'),
    entero: true,
    aSuProporcion: true,
    rotulos: RotulosDelMastil,
  },
  // Salidas es la única de abajo que pregunta al modelo y gasta una petición
  // del cupo; las ideas, que también lo hacían, se retiraron (adr/0066).
  {
    id: 'salidas',
    name: 'Salidas',
    Icono: IconoSalidas,
    render: VersionsPanel,
    precargar: () => precargar('salidas'),
  },
  // Canciones antes que Sesiones porque no son lo mismo y se confunden: una
  // canción se guarda a propósito y con nombre, y una sesión es el rastro de lo
  // que se tocó. Lo que se busca a menudo va primero.
  {
    id: 'canciones',
    name: 'Canciones',
    Icono: IconoCanciones,
    render: SongsPanel,
    precargar: () => precargar('canciones'),
  },
  {
    id: 'sesiones',
    name: 'Sesiones',
    Icono: IconoSesiones,
    render: SessionsPanel,
    precargar: () => precargar('sesiones'),
  },
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
 * La raya entre dos grupos de la fila de arriba.
 *
 * Los espacios y el metrónomo eran pastillas grises de la misma altura una
 * detrás de otra, y se leían como una sola fila de mandos iguales.
 */
function Separador() {
  return <span aria-hidden="true" data-separador className="bg-border w-px self-stretch" />;
}

/**
 * Cierra un panel de los que se abren con `popover`.
 *
 * Está montado —el botón que llama vive dentro—, y la API solo falta en jsdom:
 * los navegadores a los que va esto la traen desde 2024.
 */
function cerrarPanel(id: string): void {
  const panel = document.getElementById(id) as HTMLElement;
  if (typeof panel.hidePopover === 'function') {
    panel.hidePopover();
  }
}

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
 * - **Abajo: un área con selector de tipo.** Mástil, salidas, canciones o
 *   sesiones.
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
  // Con tonalidad la barra ya no está: al elegirla se desmonta abierta, y sin
  // mirar `activeKey` la pantalla se quedaba apagada debajo de nada.
  const tapadoPorLaRueda = !hayBanco && activeKey === null && tonalidadAbierta;

  // El reparto guardado se recupera después de pintar, como el tema: leerlo
  // durante el render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    accionesDelBanco.cargar();
  }, [accionesDelBanco]);

  /*
    El lienzo y el ensayo se piden **en cuanto la pantalla se queda quieta**.

    Van en diferido para que la primera visita no los descargue
    ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md)), pero
    son los dos espacios a los que se pasa desde aquí: pedirlos al pulsar dejaría
    un «Abriendo el lienzo…» justo cuando se va a escribir. En reposo no compiten
    con la hidratación, que es lo que la división viene a aligerar.
  */
  useEffect(() => {
    const traer = () => precargar('lienzo', 'ensayo');
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(traer);
      return () => window.cancelIdleCallback(id);
    }
    // Safari no tiene `requestIdleCallback`: un plazo corto hace de reposo.
    const id = window.setTimeout(traer, 200);
    return () => window.clearTimeout(id);
  }, []);

  /**
   * Si la canción tiene algún acorde.
   *
   * Sin él, el área del acorde no tiene nada que enseñar y lo decía con su
   * propio estado vacío, al lado del del lienzo: con la canción en blanco había
   * tres vacíos en pantalla pidiendo la mirada a la vez —el del lienzo, «Elige el
   * primer acorde» y el del micro—. Manda el del lienzo, que es donde se escribe.
   */
  const hayCancion = useArrangementStore((state) =>
    state.arrangement.parts.some((parte) => parte.blocks.length > 0),
  );
  /** Y si hay un acorde que enseñar aunque la canción esté vacía: uno probado. */
  const hayAcordeProbado = useSessionStore((state) => state.path.length > 0);

  const editor = EDITORES.find((candidato) => candidato.id === abajo) ?? null;
  /**
   * Si la canción le está dejando sitio al mástil.
   *
   * Solo los paneles de proporción propia lo piden: los demás se desplazan por
   * dentro y les da igual el alto que les toque. **Mientras cede, el arreglo se
   * desplaza**, que es lo que permite bajarle el suelo sin cortarle nada
   * ([adr/0040](../../docs/adr/0040-ni-cuadrado-ni-tira.md)).
   */
  const cediendoAlMastil = editor?.aSuProporcion === true;

  /**
   * Componer cuenta como practicar, y esta es la única pantalla que lo escucha.
   *
   * `useGananciaAlComponer` se monta **una sola vez, aquí**: cada llamada se
   * apunta a los hechos de componer por su cuenta, así que dos sumarían dos veces
   * el mismo hecho. Y el temario que hace falta para sumar viaja con el primer
   * hecho, no al abrir la pantalla.
   */
  const { composeGain, dismissComposeGain } = useGananciaAlComponer();
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
  /**
   * Estrechar y ensanchar un área sin arrastrar, desde su cabecera (WCAG 2.5.7).
   *
   * De dos en dos rem, el doble que una flecha sobre el divisor: una flecha se
   * repite dejándola pulsada y un toque no, y de uno en uno había que tocar
   * doce veces para notarlo. `mas` es «más grande» en los tres: el divisor de la
   * derecha y el de abajo crecen al revés, pero eso es cosa del arrastre.
   */
  function medidaDe(area: 'izquierda' | 'derecha' | 'alto', valor: number, eje: 'ancho' | 'alto') {
    const topes = TOPES_DEL_BANCO[area];
    return {
      eje,
      menos: () => accionesDelBanco.mover(area, valor - 2),
      mas: () => accionesDelBanco.mover(area, valor + 2),
      puedeMenos: valor > topes.min,
      puedeMas: valor < topes.max,
    };
  }

  /** Los dos paneles que se abren desde la fila de arriba en un teléfono. */
  const idTonalidad = useId();
  const idBandeja = useId();
  // Pasar por la fila ya trae los cuatro: un panel de abajo es un par de
  // decenas de KB, y lo que cuesta es esperarlo al pulsar.
  const precargarLaBandeja = () => EDITORES.forEach((candidato) => candidato.precargar());

  /**
   * Qué se ve abajo: el mástil, las salidas, las canciones y las sesiones.
   *
   * En el banco es la fila de abajo de siempre, a lo ancho. En un teléfono es
   * una lista dentro de «Más», y elegir uno cierra el panel: lo elegido se abre
   * abajo, y el panel encima lo taparía.
   */
  const bandeja = (
    <section
      aria-label="Qué se ve abajo"
      className={hayBanco ? 'border-border flex shrink-0 flex-col border-t' : 'flex flex-col'}
    >
      <div
        className={hayBanco ? 'flex gap-1.5 overflow-x-auto px-3 py-2' : 'flex flex-col gap-1.5'}
        onPointerOver={precargarLaBandeja}
        onFocus={precargarLaBandeja}
      >
        {EDITORES.map((candidato) => (
          <Chip
            key={candidato.id}
            onClick={() => {
              accionesDelBanco.abrirAbajo(candidato.id);
              if (!hayBanco) {
                cerrarPanel(idBandeja);
              }
            }}
            pressed={abajo === candidato.id}
            tone="quiet"
            tamano="compacto"
            className={hayBanco ? 'shrink-0' : 'justify-start'}
          >
            <candidato.Icono />
            {candidato.name}
          </Chip>
        ))}
      </div>
    </section>
  );

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
        // En un teléfono, sin la línea: compartía fila con el título y la barra,
        // y lo que le tocaba eran cuatro letras y unos puntos suspensivos.
        {...(hayBanco
          ? {
              lead:
                espacio === 'tocando'
                  ? 'Toca, y lo que suena se escribe solo.'
                  : espacio === 'ensayar'
                    ? 'Tócala contra el metrónomo, y te digo cómo ha ido.'
                    : 'Escribe la canción, mírala acorde a acorde y escúchala.',
            }
          : {})}
        accionesCrecen={!hayBanco}
        actions={
          /*
            **En un teléfono, una sola fila que se desplaza de lado.**

            Eran dos filas que se envolvían —los espacios y las pestañas arriba,
            el metrónomo entero debajo—, y con la línea de la tonalidad y la
            bandeja de abajo el marco se llevaba 365 píxeles de 844: quedaban 479
            para trabajar. Ahora todo lo que se elige va aquí, en el orden en que
            se usa, y lo que no cabe se alcanza arrastrando, con la pista de
            `hay-mas-al-lado` que dice que sigue.

            **Ocupa lo que deja el título**, con `accionesCrecen`: midiendo lo
            que mide su contenido, una fila de seiscientos píxeles en un hueco de
            doscientos sesenta se bajaba a un renglón propio.
          */
          <div
            className={`flex items-center gap-2 ${
              hayBanco ? 'flex-wrap' : 'hay-mas-al-lado w-full overflow-x-auto [&>*]:shrink-0'
            }`}
          >
            {/* Los espacios de trabajo antes que el metrónomo: son lo que cambia
                la pantalla entera, y lo que cambia más cosas va primero. */}
            {/*
              En un teléfono, **los espacios son también las pestañas**.

              Había dos filas: los tres espacios arriba y, debajo, «Tocando · A
              dónde ir · Acorde», cuya primera pestaña repetía el espacio ya
              elegido con otro nombre. Eran unos cincuenta píxeles —de los
              doscientos noventa de mandos que había antes de la canción— para
              decir dos veces lo mismo. Ahora es una fila: pulsar un espacio
              enseña su área, y las otras dos pestañas van detrás.

              Se precargan al pasar por encima o al llegar con el tabulador, por
              si se llega antes de que la pantalla haya tenido un momento de
              reposo (adr/0058).
            */}
            <span
              className="flex gap-1"
              role="group"
              aria-label="Espacio de trabajo"
              onPointerOver={() => precargar('lienzo', 'ensayo')}
              onFocus={() => precargar('lienzo', 'ensayo')}
            >
              {ESPACIOS.map((candidato) => (
                <Chip
                  key={candidato.id}
                  onClick={() => {
                    accionesDelBanco.espacio(candidato.id);
                    setAreaMovil('arreglo');
                  }}
                  pressed={espacio === candidato.id && (hayBanco || areaMovil === 'arreglo')}
                  tone="quiet"
                  tamano="compacto"
                  ariaLabel={candidato.name}
                  atajo={candidato.atajo}
                >
                  <candidato.Icono />
                  {/* En un teléfono, solo el icono: la fila se desplaza, y con los
                      tres rótulos las pestañas de detrás quedaban siempre fuera. */}
                  <span className="hidden sm:inline">{candidato.name}</span>
                </Chip>
              ))}
              {!hayBanco && activeKey !== null && (
                <>
                  <Separador />
                  {(
                    [
                      ['camino', 'A dónde ir'],
                      ['acorde', 'Acorde'],
                    ] as const
                  ).map(([id, nombre]) => (
                    <Chip
                      key={id}
                      onClick={() => setAreaMovil(id)}
                      pressed={areaMovil === id}
                      tone="quiet"
                      tamano="compacto"
                    >
                      {nombre}
                    </Chip>
                  ))}
                </>
              )}
            </span>

            {/* **Una raya entre los espacios y el metrónomo.** Tenían la misma
                pinta —pastillas grises de la misma altura— y «− 100 +» se leía
                como otro espacio de trabajo más. */}
            <Separador />
            <Metronome />

            {/*
              La tonalidad, **dentro de la fila cuando ya hay una**.

              Sin tonalidad la barra de abajo se abre sola, y tiene que poder: es
              lo primero que se pide. Con ella puesta, esa barra era una fila de
              cuarenta y cinco píxeles para decir «Do mayor», que se mira y no se
              toca. Aquí es una pastilla que abre la rueda y los ajustes en un
              panel por encima de todo, como el del metrónomo y por lo mismo: un
              panel anclado dentro de esta fila lo recortaría el desplazamiento.
            */}
            {!hayBanco && activeKey !== null && (
              <>
                <button
                  type="button"
                  popoverTarget={idTonalidad}
                  className="border-border text-text-muted hover:border-brass-dim hover:text-text min-h-tap inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 text-[13px] font-medium"
                >
                  <IconoAfinar />
                  <span className="text-brass-bright">
                    {keyName(activeKey.tonic, activeKey.mode)}
                  </span>
                </button>
                <div
                  id={idTonalidad}
                  popover="auto"
                  role="region"
                  aria-label="Cambiar la tonalidad"
                  className="superficie-alta text-text backdrop:bg-night/50 m-auto max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-3"
                >
                  <div className="flex flex-col items-center gap-2">
                    <KeyPanel compact />
                    <Settings />
                  </div>
                </div>
              </>
            )}

            {/*
              La bandeja de abajo, **plegada a «Más»** en un teléfono.

              Era una fila fija de sesenta y un píxeles con cuatro paneles que se
              abren de vez en cuando —el mástil, las salidas, las canciones y las
              sesiones— y que en ningún móvil cabía entera. Lo que se abre sigue
              apareciendo abajo, con su botón de cerrar; lo que se va es la fila.
            */}
            {!hayBanco && (
              <>
                <button
                  type="button"
                  popoverTarget={idBandeja}
                  onPointerOver={precargarLaBandeja}
                  onFocus={precargarLaBandeja}
                  className="border-border text-text-muted hover:border-brass-dim hover:text-text min-h-tap inline-flex cursor-pointer items-center rounded-md border px-3 text-[13px] font-medium"
                >
                  Más
                </button>
                <div
                  id={idBandeja}
                  popover="auto"
                  className="superficie-alta text-text backdrop:bg-night/50 m-auto w-[min(20rem,calc(100vw-2rem))] p-3"
                >
                  {bandeja}
                </div>
              </>
            )}

            {/* Lo que queda de IA, a la vista antes de gastarlo: estaba solo
                dentro del panel que lo gasta, así que para saberlo había que
                abrir el que ibas a usar
                ([adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)). */}
            <CupoDeIA className="px-2" />

            {/* La salida para quien se lo ha dejado imposible. Un banco que se
                mueve necesita una manera de volver, o plegar y arrastrar dan
                miedo; y como el reparto es de este espacio, devolverlo no toca
                los otros dos. **«Restablecer paneles» y no «Reordenar»**: no
                ordena nada, devuelve el reparto de fábrica, y el nombre tiene
                que decir lo que se pierde al pulsarlo. */}
            {hayBanco && (
              <button
                type="button"
                onClick={() => accionesDelBanco.devolverElReparto()}
                className="text-text-muted hover:text-brass-bright min-h-tap inline-flex cursor-pointer items-center px-2 text-xs"
                title={`Devolver las áreas a como venían en este espacio · ${ATAJOS.devolver}`}
                aria-keyshortcuts={ATAJOS.devolver}
              >
                Restablecer paneles
              </button>
            )}
          </div>
        }
      />

      {/* Se ofrece la última sesión, no se pone. Desaparece sola en cuanto
          eliges tonalidad o tocas algo. */}
      <ResumeLast />

      {/* En estrecho la tonalidad se pliega a una línea: la rueda ocupa media
          pantalla de teléfono y es justo lo que se toca una vez al empezar. En
          el banco vive en su área y esta barra no existe.

          **Y solo mientras falta.** Con tonalidad puesta, la línea pasa a ser
          una pastilla de la fila de arriba (más arriba se cuenta), y esta fila
          de cuarenta y cinco píxeles se devuelve a la canción. */}
      {activeKey === null && (
        <div className="border-border bg-surface shrink-0 border-b px-3 lg:hidden">
          <BarraDeTonalidad onAbrirse={setTonalidadAbierta}>
            {/*
              Las cuatro de salida, dentro del panel.

              No es por sitio, es que **lo de debajo no se ve**: esta barra flota
              sobre la pantalla y se abre ella sola mientras no hay tonalidad, así
              que en un teléfono el estado vacío de componer —con sus cuatro
              botones y el micro— quedaba entero detrás del panel. Los atajos para
              quien no sabe cuál elegir eran justo lo inalcanzable.
            */}
            <CuatroTonalidades>Empieza por una:</CuatroTonalidades>
          </BarraDeTonalidad>
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
          medida={medidaDe('izquierda', izquierda, 'ancho')}
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
            onArrastrar={(rem) => accionesDelBanco.arrastrar('izquierda', rem)}
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
            // **Se desplaza solo mientras el mástil está abierto.** Fuera de
            // eso no se desplaza y por eso necesita suelo: lo que no le quepa
            // al lienzo se recorta y deja su barra sin alcanzar.
            //
            // Con el mástil delante la cuenta cambia: lo que decide el tamaño
            // de las notas es el alto, y el alto sale de aquí. Cediéndole
            // cuarenta y ocho píxeles, las notas del mástil pasan de 22 a 32 de
            // separación en una ventana baja. Lo que el arreglo pierde de alto
            // no se pierde: se alcanza desplazándolo, que es la diferencia
            // entre ceder y cortar.
            scroll={cediendoAlMastil}
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
            // **El suelo de escritorio era mentira y lo dice la medida.** Decía
            // diez rem, y con ese alto al arreglo no le caben sus propios
            // mandos: la fila de «Qué poner ahora» y un botón se quedaban
            // cortados. Barriendo alturas contra la sonda de medidas, lo que
            // necesita para no cortarse nada son 220 px por debajo de 1280 —la
            // barra se parte en más filas cuanto más estrecho— y 170 por
            // encima. Van catorce y once rem, que es lo medido redondeado hacia
            // arriba.
            className={`min-h-[26rem] grow ${
              cediendoAlMastil ? 'lg:min-h-32' : 'lg:min-h-56 xl:min-h-44'
            } ${hayBanco || areaMovil === 'arreglo' ? '' : 'hidden'}`}
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
            ) : (
              /* Cediendo, el área se desplaza y **lo de dentro necesita un alto
                que defender**: el lienzo es una columna con `min-h-0`, así que
                sin esto se encogía a cero y el panel de «Qué poner ahora» salía
                entero fuera de la pantalla. Con el suelo puesto aquí, lo que no
                cabe se alcanza desplazando el área.
                Sin ceder no estorba: `contents` lo saca de la maqueta. */
              <div
                className={
                  cediendoAlMastil
                    ? 'flex min-h-[22rem] w-full min-w-0 flex-col lg:min-h-[20rem]'
                    : 'contents'
                }
              >
                {espacio === 'tocando' ? (
                  <TocarParaEscribir onEscrito={() => accionesDelBanco.espacio('escribir')} />
                ) : (
                  // Tocando se queda en el paquete de entrada: es por donde se
                  // entra. Los otros dos llegan después (adr/0058).
                  <Suspense
                    fallback={<Abriendo que={espacio === 'ensayar' ? 'el ensayo' : 'el lienzo'} />}
                  >
                    {espacio === 'ensayar' ? <Ensayo /> : <ArrangeCanvas />}
                  </Suspense>
                )}
              </div>
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
                la primera salía partida por el borde. Este cajón existe para ver
                a qué acordes puedes cambiar; si no se ve ninguno, no existe.

                El suelo va por tramos de altura de ventana, y cada tramo es un
                acorde más a la vista. Medido con tres acordes escritos:

                  604  → 16rem, dos acordes
                  700  → 14rem, dos
                  800  → 18rem, tres
                  900  → 24rem, cuatro
                  1080 → 30rem, seis

                El tramo de menos de 660 pide además **1100 de ancho**, y no es
                capricho: por debajo de eso la barra del lienzo se parte en más
                filas y el lienzo necesita 274 px para no recortar lo suyo —lo
                dice la sonda—, que es justo lo que quedaría. Ahí el cajón cede
                entero, como antes.

                Los tramos son **excluyentes** —`min-height` y `max-height` a la
                vez— y no escalones abiertos: dos reglas de `min-height` que casan
                a la vez tienen la misma especificidad y gana la que Tailwind
                escriba después, que no es la que quieres. Con escalones abiertos,
                una ventana de 1080 se quedaba en el valor de 900.

                Por debajo de 660 no hay suelo y vuelve a ceder: ahí plantarse es
                lo que deja la barra del lienzo fuera de alcance, comprobado con
                la sonda —cuatro elementos inalcanzables—, y entre quedarse sin
                partitura o sin lista, manda la canción.

                Y apilada ocupa lo que le dejen: es la única área a la vista, así
                que quedarse en trece rem dejaba media pantalla en negro debajo de
                una sola propuesta.
              */
              className={
                caminoPlegado
                  ? ''
                  : 'border-border shrink basis-52 border-t max-lg:grow [@media(max-height:659px)_and_(min-width:1100px)]:min-h-64 [@media(min-height:1040px)]:min-h-[30rem] [@media(min-height:660px)_and_(max-height:779px)]:min-h-56 [@media(min-height:780px)_and_(max-height:899px)]:min-h-72 [@media(min-height:900px)_and_(max-height:1039px)]:min-h-96'
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
            onArrastrar={(rem) => accionesDelBanco.arrastrar('derecha', rem)}
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
            medida={hayBanco ? medidaDe('derecha', derecha, 'ancho') : undefined}
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
            {/* Con la canción en blanco y nada probado, el acorde no tiene qué
                enseñar: su «Elige el primer acorde» era el segundo de tres vacíos
                en la misma pantalla. Manda el del lienzo, que es donde se escribe;
                debajo se queda el micro, que es una oferta y no un vacío. */}
            {(hayCancion || hayAcordeProbado) && (
              <>
                <CurrentChord />
                <Voicings />
              </>
            )}
            {/* Y lo que se oye también entra en la canción, no en el camino:
                tocar un acorde y quedárselo es componer. */}
            <HeardChord onPoner={ponerEnLaCancion} />
          </Area>
        )}
      </div>

      {/* Sin divisor para el mástil: su alto sale de su proporción, y un mando
        que no mueve nada es peor que no tenerlo. */}
      {editor !== null && editor.aSuProporcion !== true && (
        <Divisor
          orientacion="horizontal"
          valor={alto}
          min={TOPES_DEL_BANCO.alto.min}
          max={TOPES_DEL_BANCO.alto.max}
          sentido={-1}
          etiqueta={`Alto de ${editor.name}`}
          onCambio={(rem) => accionesDelBanco.mover('alto', rem)}
          onArrastrar={(rem) => accionesDelBanco.arrastrar('alto', rem)}
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
            // El mástil no: su alto sale de su proporción, y un mando que no
            // mueve nada es peor que no tenerlo, igual que su divisor.
            medida={
              hayBanco && editor.aSuProporcion !== true ? medidaDe('alto', alto, 'alto') : undefined
            }
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
            // Con proporción propia **no se le da alto: se le deja pedirlo**, y
            // el tope es lo único que se le pone. Veintidós rem es lo que hay
            // que dejar libre —las dos barras de arriba, la de abajo y el suelo
            // del arreglo—, así que el mástil puede crecer hasta llenar su
            // ancho sin empujar a la canción por debajo de su suelo ni sacar
            // una barra de desplazamiento.
            className={
              editor.aSuProporcion === true
                ? 'border-border flex min-h-0 shrink flex-col border-t max-lg:max-h-[60vh]'
                : 'border-border max-h-[60vh] shrink-0 border-t lg:h-[var(--banco-alto)] lg:max-h-[42vh]'
            }
            mandos={
              <>
                {editor.rotulos !== undefined && (
                  <Suspense fallback={null}>
                    <editor.rotulos />
                  </Suspense>
                )}
                <button
                  type="button"
                  onClick={() => accionesDelBanco.abrirAbajo(null)}
                  aria-label={`Cerrar ${editor.name}`}
                  title="Cerrar"
                  // Del tamaño del de plegar, y por lo mismo: era veinte por doce.
                  className="text-text-muted hover:text-oxblood-bright inline-flex min-w-11 cursor-pointer items-center justify-center self-stretch"
                >
                  <IconoCerrar />
                </button>
              </>
            }
          >
            {/* El relleno del área, y **parte del reparto**: como bloque suelto se
              quedaba con su alto natural dentro de una caja más baja, y lo que
              llevaba dentro —el mástil— se salía por abajo sin manera de
              alcanzarlo. */}
            <div
              className={`flex min-h-0 grow flex-col ${
                editor.aSuProporcion === true ? 'px-3 pb-2' : 'p-3'
              }`}
            >
              <Suspense fallback={<Abriendo que={editor.name.toLowerCase()} />}>
                <editor.render />
              </Suspense>
            </div>
          </Area>
        )}

        {/* En el banco, la fila de siempre; en un teléfono vive en «Más». */}
        {hayBanco && bandeja}
      </div>
    </div>
  );
}
