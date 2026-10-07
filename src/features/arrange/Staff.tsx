'use client';

import { memo, useCallback, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
  figuraDe,
  isDoubtfulNote,
  keySignature,
  MAX_OFFSET,
  offsetOfStep,
  blockChord,
  writeNote,
  type Block,
  type KeyMode,
  type LeadNote,
  type PitchClass,
} from '@core/music';

import { useArrastre } from './arrastrar';
import { BOLITA, CLAVE_DE_SOL, ESPACIO_CLAVE } from './clef';
import { useMedida } from '@ui/use-medida';

/**
 * La partitura: el mismo punteo, escrito.
 *
 * No es otra cosa que el carril de bloques: son las mismas notas, el mismo píxel
 * por pulso y las mismas acciones. Lo que cambia es que aquí la altura se lee en
 * un pentagrama y la duración en una figura, que es como lo lee quien sabe.
 *
 * ## Lo que se dibuja y lo que no
 *
 * Se dibuja lo que el modelo tiene: cinco líneas, la armadura de la tonalidad, la
 * indicación de compás, barras de compás con su barra final, los cifrados encima y
 * una figura por nota, de la semicorchea a la redonda con sus puntillos.
 *
 * Las medidas del grabado —cabeza, plica, líneas adicionales— **salen del espacio
 * del pentagrama y no de píxeles probados a ojo**, y están juntas más abajo con el
 * porqué de cada una: la cabeza llena el espacio, la plica mide tres espacios y
 * medio y la adicional sobresale de la cabeza. Puestas a ojo, la partitura se leía
 * como cinco rayas con puntitos. **No hay ligaduras, ni tresillos, ni dos voces, ni
 * silencios escritos.** No es una renuncia de dibujo: es que el modelo no tiene
 * ninguna de esas cosas, y `melody.ts` limita las duraciones justo a las siete que
 * tienen figura para que nunca haya una nota que no se pueda escribir.
 *
 * Una nota que dura más de lo que le queda al compás se dibuja donde empieza y
 * cruza la barra. Con ligadura sería lo correcto; sin ella se lee igual de bien y
 * el modelo no sabría dónde partirla.
 *
 * ## Arrastrar por escalones, no por semitonos
 *
 * Subir una nota en la partitura la lleva a la línea de encima, y qué nota es esa
 * lo decide la armadura: en Sol mayor, subir del Mi da un Fa **sostenido**. Los
 * cromatismos no se escriben moviendo la nota, sino alterándola, y para eso están
 * las teclas de más y menos.
 */

/**
 * Lo que mide un pulso en la partitura, y por qué no es fijo.
 *
 * En la tira de bloques el píxel por pulso es constante, porque ahí la anchura de
 * una caja **es** su duración y hay que poder compararlas de un vistazo. Una
 * partitura no funciona así: un sistema se justifica al ancho del papel, y cuatro
 * compases ocupan la línea entera igual que ocho. Con la medida fija, una parte
 * corta salía como un sello en la esquina de una pantalla vacía.
 *
 * Entre los dos topes: por debajo del mínimo las notas se pisan, y por encima del
 * máximo cuatro compases se estiran hasta parecer una pancarta.
 *
 * **El mínimo sale de una división.** Las notas caen en una rejilla de medio
 * pulso, así que dos vecinas distan medio pulso de papel; para que no se toquen,
 * ese medio pulso tiene que medir al menos una cabeza entera. De ahí el 28: con
 * el 20 de antes, dos corcheas seguidas se solapaban en cuanto la cabeza pasó a
 * medir lo que mide una cabeza.
 */
const PULSO_MINIMO = 28;
const PULSO_MAXIMO = 46;

/**
 * Lo que la hoja se come de su caja: el `px-2` de cada lado y el borde de
 * `.superficie`.
 *
 * Se repartía el ancho de la caja de fuera como si fuera todo papel, y la hoja
 * le sumaba luego su relleno y su borde: dieciocho píxeles de más, de los que
 * catorce salían por la derecha —727 de hoja en 713 de hueco, medido a 1440—.
 */
const PAPEL = 18;

/** Medio espacio del pentagrama: lo que sube una nota al pasar de línea a espacio. */
const PASO = 6;

/** Dónde cae la línea de abajo del pentagrama, contando desde arriba del dibujo. */
const BASE = 82;

/**
 * Lo que mide de alto la zona de agarre de un cifrado: **los 44 px de todo lo
 * que se pulsa**, también dentro de un SVG.
 *
 * Empieza en 4 y la primera línea del pentagrama está en 34 unidades de la
 * banda, pero la banda va encima del aire que se reserva para las notas agudas
 * —`respiro`, que con el techo del modelo son 36 o más—, así que la primera
 * línea cae en pantalla a 70 o más y los 44 no la tocan. Lo que sí pisan son las
 * 22 unidades de aire más altas, donde solo caen las notas de dos y tres líneas
 * adicionales: una nota ya escrita ahí se dibuja después y se coge antes que el
 * cifrado; lo que se pierde es escribir una nueva pulsando en ese aire bajo un
 * cifrado. Con 28 medía 29 px en pantalla y era el mando principal de la vista
 * por defecto.
 */
const ALTO_DEL_AGARRE = 44;

/**
 * Lo que baja el segundo corchete por la plica.
 *
 * Seis píxeles: lo justo para que se lean dos y no un borrón. Menos y parecen
 * uno grueso, que es exactamente la confusión que hay que evitar —un corchete o
 * dos es la diferencia entre una corchea y una semicorchea—.
 */
const SEPARACION_CORCHETES = 6;

/**
 * Dónde acaba la clave y puede empezar la armadura.
 *
 * La clave se ensancha a los dos lados de su espiral; este número es el canto
 * derecho más un respiro.
 */
const CLAVE_HASTA = 44;

/** Lo que ocupa cada alteración de la armadura a lo ancho. */
const PASO_ARMADURA = 8;

const ALTO = 130;

/**
 * Cuánto se encoge la clave para caber en el pentagrama.
 *
 * **Sale de una división, no de probar números.** El dibujo se hizo con un
 * espacio de pentagrama que vale `ESPACIO_CLAVE`, y aquí un espacio son dos
 * pasos; la escala es el cociente. Si algún día el pentagrama crece, la clave
 * crece con él y sigue midiendo lo que debe: una clave de sol ocupa algo más que
 * las cinco líneas, porque sobresale con el gancho por arriba y con la cola por
 * abajo.
 */
const ESCALA_CLAVE = (2 * PASO) / ESPACIO_CLAVE;

/**
 * A qué distancia del borde se planta el centro de la espiral.
 *
 * Es el centro y no el canto izquierdo: la clave se ensancha hacia la izquierda
 * con la panza de la espiral, así que este número tiene que dejarle sitio a eso.
 *
 * Sale de la caja del contorno, no del gusto: la clave llega a 24,4 unidades por
 * la izquierda, que al 0,6 de escala son 14,6 píxeles, y las cinco líneas
 * empiezan en el cuatro. Cada vez que cambie el trazo hay que volver a medirla.
 */
const MARGEN_CLAVE = 19;

/** El `step` de la línea de abajo del pentagrama en clave de sol: el Mi de la 4.ª. */
const STEP_BASE = 2;

/**
 * La cabeza de la nota, en medidas de pentagrama y no en píxeles sueltos.
 *
 * Una cabeza negra **llena el espacio**: un espacio de alto —que aquí son dos
 * pasos, o sea `ry = PASO`— y algo más de ancho, inclinada unos veinte grados.
 *
 * Estaba en `ry 3.8` sobre un espacio de doce, o sea al 63 %, y de ahí venía
 * media impresión de partitura pobre: las notas flotaban en medio del hueco en
 * vez de ocuparlo, y el pentagrama se leía como cinco rayas con puntitos.
 */
const CABEZA_RY = PASO;
const CABEZA_RX = PASO * 1.32;
const INCLINACION = 20;

/**
 * Medio ancho de la cabeza **ya girada**, que no es `CABEZA_RX`.
 *
 * De aquí salen la plica —que se pega al canto de la cabeza, no a su centro— y
 * el puntillo. Girar una elipse la ensancha menos de lo que parece, y ponerlo a
 * ojo deja la plica despegada o metida dentro de la cabeza.
 */
const CABEZA_MEDIO_ANCHO = Math.hypot(
  CABEZA_RX * Math.cos((INCLINACION * Math.PI) / 180),
  CABEZA_RY * Math.sin((INCLINACION * Math.PI) / 180),
);

/**
 * Medio largo de una línea adicional.
 *
 * Sobresale de la cabeza por los dos lados: una adicional que muere justo en el
 * canto parece un tachón, y es lo que pasaba desde que la cabeza creció —los
 * ocho píxeles de antes daban para una cabeza de cinco, no para una de siete—.
 */
const LARGO_ADICIONAL = CABEZA_MEDIO_ANCHO + 4;

/**
 * Lo que mide una plica: tres espacios y medio, que es la medida de toda la vida.
 *
 * Estaba en 26 píxeles, que sobre un espacio de doce son 2,2 espacios: cortas, y
 * todas iguales aunque la nota estuviera lejos del pentagrama.
 */
const PLICA_LARGO = 3.5 * 2 * PASO;

/** Lo que ocupa la indicación de compás, con su respiro antes de la música. */
const ANCHO_COMPAS = 24;

/**
 * Lo alta que es una cifra respecto de su cuerpo de letra, en la sans de casa.
 *
 * Un `fontSize` no es la altura de lo que se ve: es la caja entera, con el
 * hueco de los rasgos que bajan y el de los acentos. Una cifra ocupa algo menos
 * de tres cuartos, y es esa altura la que tiene que llenar dos espacios.
 */
const PROPORCION_CIFRA = 0.72;

/**
 * Dónde se asienta y cuánto mide cada cifra de la indicación de compás.
 *
 * **Cada una llena su mitad del pentagrama**: la de arriba de la quinta línea a
 * la tercera, la de abajo de la tercera a la primera. Es lo que hace cualquier
 * partitura impresa, y por eso se escribe aquí como cuenta y no como número.
 *
 * Estaban a ojo —la base ocho píxeles por debajo de la tercera línea y de la
 * primera, a 22 de cuerpo—, y salían una mitad corridas hacia abajo: el número
 * de arriba caía en la mitad de abajo y el de abajo colgaba por debajo de la
 * última línea, que es la manera más rápida de que una partitura parezca hecha
 * por quien no ha visto ninguna.
 */
export const CIFRAS_DEL_COMPAS = {
  /** La base de la de arriba va sobre la tercera línea; la de abajo, sobre la primera. */
  baseArriba: BASE - 4 * PASO,
  baseAbajo: BASE,
  /** Dos espacios de alto: media pauta. */
  alto: 4 * PASO,
  cuerpo: (4 * PASO) / PROPORCION_CIFRA,
  /** Las cinco líneas, para que quien lo compruebe no copie los números. */
  lineaDeArriba: BASE - 8 * PASO,
  lineaDelMedio: BASE - 4 * PASO,
  lineaDeAbajo: BASE,
} as const;

/**
 * En qué escalón va cada alteración de la armadura, y **son dos tablas**.
 *
 * Los sostenidos y los bemoles no se escriben en las mismas alturas: es una
 * convención de cuatro siglos, no una consecuencia de nada. El primer sostenido
 * —el Fa— va en la **línea de arriba** del pentagrama, y el primer bemol —el
 * Si— en la tercera línea. De ahí sale el dibujo de sierra que tienen todas las
 * armaduras.
 *
 * Estaba con una sola tabla, y además desplazada un escalón: el sostenido del Fa
 * caía en el espacio de debajo de su línea. Se ve en cuanto se pone una
 * tonalidad con alteraciones al lado de cualquier partitura impresa.
 *
 * Los `step` cuentan desde el Do de la cuarta octava, así que la línea inferior
 * del pentagrama —el Mi— es 2 y la superior —el Fa— es 10.
 */
const ALTURA_SOSTENIDOS: Readonly<Record<string, number>> = {
  F: 10,
  C: 7,
  G: 11,
  D: 8,
  A: 5,
  E: 9,
  B: 6,
};

const ALTURA_BEMOLES: Readonly<Record<string, number>> = {
  B: 6,
  E: 9,
  A: 5,
  D: 8,
  G: 4,
  C: 7,
  F: 3,
};

/** La caja de un pentagrama que no está montado. No pasa; TypeScript no lo sabe. */
const SIN_PENTAGRAMA = { left: 0, top: 0 } as DOMRect;

/**
 * Lo que ocupa a lo ancho la pista del pentagrama vacío, en su línea más larga.
 *
 * Es una estimación —un SVG no parte el texto ni dice cuánto mide sin montarlo—:
 * veintiocho letras de doce píxeles en la sans. Sirve para que la pista,
 * centrada bajo el primer sistema, no se salga por ningún lado cuando la hoja
 * es más estrecha que ella, que es lo que pasa en un teléfono con un compás.
 */
const ANCHO_PISTA = 176;

/**
 * El cuerpo de la pista: los doce de la casa, que es el mínimo de todo lo que se
 * lee (`docs/ESTILO.md`). Iba a once, pegada a la clave.
 */
const CUERPO_PISTA = 12;

/** Lo que hay entre la línea de abajo del pentagrama y la primera de la pista. */
const BAJO_LA_PAUTA = 26;

/**
 * Cuántos compases van en cada sistema, cuántos sistemas salen y a cuánto toca
 * el pulso.
 *
 * **Una partitura que no cabe en una línea se parte en varias**, como cualquier
 * partitura de verdad, y no se desplaza de lado
 * ([adr/0064](../../../docs/adr/0064-la-partitura-se-parte-en-sistemas.md)). En
 * un teléfono, cuatro compases a su ancho mínimo medían 552 píxeles en una caja
 * de 364: se veían tres y el cuarto quedaba detrás de un desplazamiento que nada
 * anunciaba.
 *
 * - Caben los compases que quepan **a su pulso mínimo**, y al menos uno.
 * - Los compases se reparten a partes iguales entre los sistemas que hagan
 *   falta: cinco que caben de cuatro en cuatro salen tres y dos, no cuatro y uno
 *   colgando.
 * - **Todos los sistemas llevan el mismo pulso**, así que el mismo pulso de cada
 *   compás cae en la misma columna en todos: las barras quedan alineadas, como
 *   en una hoja guía, y un sistema corto es más corto en vez de más estirado.
 *
 * Sin medida —el primer pintado, o jsdom— no se parte: no hay ancho con el que
 * decidirlo, y partir en uno por compás sería lo peor de los dos mundos.
 */
export function repartoEnSistemas(
  disponible: number,
  margen: number,
  compases: number,
  beatsPerBar: number,
): { sistemas: number; porSistema: number; porPulso: number } {
  const util = disponible - PAPEL - margen - 12;
  const caben = Math.max(1, Math.floor(util / (beatsPerBar * PULSO_MINIMO)));
  const sistemas = disponible === 0 ? 1 : Math.ceil(compases / caben);
  const porSistema = Math.ceil(compases / sistemas);
  const porPulso = Math.min(
    PULSO_MAXIMO,
    Math.max(PULSO_MINIMO, util / (porSistema * beatsPerBar)),
  );
  return { sistemas, porSistema, porPulso };
}

/**
 * Si una tecla activa lo que tiene el foco, como lo haría en un botón.
 *
 * Los acordes y las notas son `<g>` y no `<button>` —dentro de un SVG no hay
 * otra cosa—, así que `Intro` y `Espacio` no disparan el `click` por su cuenta.
 * Sin esto, con el teclado se llegaba a un acorde y no había forma de elegirlo.
 */
function activa(event: ReactKeyboardEvent): boolean {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return false;
  }
  // `Espacio` desplazaría la página además de elegir.
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function yDeStep(step: number): number {
  return BASE - (step - STEP_BASE) * PASO;
}

export interface StaffProps {
  readonly notes: readonly LeadNote[];
  readonly blocks: readonly Block[];
  /** Compases que se dibujan, estén llenos o no. */
  readonly bars: number;
  readonly beatsPerBar: number;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly selectedNoteId: string | null;
  readonly selectedBlockId: string | null;
  readonly partName: string;
  readonly partId: string;
  /** Entre qué dos compases caería lo que se está arrastrando, si es aquí. */
  readonly dropAt: number | null;
  readonly onSelectBlock: (blockId: string) => void;
  /**
   * Las teclas sobre un cifrado —flechas, `Shift` y flechas, `Supr`—, que son
   * **las mismas que sobre un bloque** y las decide el lienzo.
   *
   * Aquí solo se borraba: el panel de lo elegido prometía que las flechas
   * movían el acorde, y en esta vista, que es la que se ve al entrar, no movían
   * nada. Con una sola función para las dos vistas no pueden volver a decir
   * cosas distintas.
   */
  readonly onBlockKeyDown: (event: ReactKeyboardEvent<Element>, blockId: string) => void;
  readonly onResizeBlock: (blockId: string, beats: number) => void;
  /** Lleva un acorde a otro sitio de la parte. */
  readonly onMoveBlock: (blockId: string, to: number) => void;
  /**
   * Escribe una nota a esa altura y en ese pulso.
   *
   * La altura llega ya en semitonos sobre la tónica, y no en escalones del
   * pentagrama: el escalón es cosa del dibujo, y traducirlo aquí es lo que
   * permite que las dos vistas del punteo hablen con el mismo modelo.
   */
  readonly onAdd: (offset: number, start: number) => void;
  readonly onSelect: (noteId: string) => void;
  readonly onMove: (noteId: string, start: number, offset: number) => void;
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
}

export const Staff = memo(function Staff({
  notes,
  blocks,
  bars,
  beatsPerBar,
  tonic,
  mode,
  selectedNoteId,
  selectedBlockId,
  partName,
  partId,
  dropAt,
  onSelectBlock,
  onBlockKeyDown,
  onResizeBlock,
  onMoveBlock,
  onAdd,
  onSelect,
  onMove,
  onGestureStart,
  onGestureEnd,
}: StaffProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  /**
   * Si el último gesto fue un arrastre.
   *
   * El `click` se dispara igual después de soltar, y si se sueltan doce píxeles
   * más arriba llega al pentagrama en vez de a la nota: **escribía una nota
   * nueva justo donde se acababa de soltar la que se movía**. Se apunta que hubo
   * arrastre y el pentagrama deja pasar ese `click`.
   */
  const arrastradaRef = useRef(false);
  const empezarArrastre = useArrastre();
  const armadura = keySignature(tonic, mode);

  /**
   * Cuánto se reserva antes de que empiece el tiempo, y **depende de la
   * tonalidad**.
   *
   * Era un número fijo —cincuenta y dos— calculado para Do mayor, que no tiene
   * armadura. En Fa sostenido hay seis sostenidos, y con el hueco fijo se
   * escribían encima de la clave y se metían en el primer compás: la partitura
   * de las tonalidades con más alteraciones salía ilegible justo por el lado que
   * más hay que leer. Ahora el hueco crece con lo que hay que meter en él.
   */
  const margen = CLAVE_HASTA + armadura.letters.length * PASO_ARMADURA + ANCHO_COMPAS + 12;

  /**
   * El aire que se abre por arriba cuando la música sube por encima del pentagrama.
   *
   * Los cifrados viven en una banda fija sobre las cinco líneas, y una nota con
   * dos líneas adicionales llega justo ahí: la cabeza salía atravesada por la
   * línea del cifrado. Se vio en cuanto la cabeza pasó a medir un espacio entero.
   *
   * En vez de mover el pentagrama —que obligaría a recalcular todo lo que cuelga
   * de `BASE`—, **el cuadro crece hacia arriba**: el `viewBox` empieza en negativo
   * y la banda de cifrados sube con él. Todo lo demás sigue en las coordenadas de
   * siempre, y lo único que hay que corregir es el clic, que llega en píxeles de
   * pantalla.
   *
   * **El aire está siempre puesto, y lo que mide sale del modelo**: se reserva
   * hasta donde `MAX_OFFSET` deja escribir, que son dos octavas sobre la tónica.
   *
   * Medido con lo que hay escrito en cada momento, la partitura pegaba un salto
   * hacia abajo justo al escribir una nota aguda —dieciséis píxeles entre donde se
   * pulsaba y donde aparecía la cabeza—, porque el hueco se abría después del
   * clic. Con un número fijo a ojo el salto volvía en las tonalidades altas, donde
   * la misma nota cae más arriba en el pentagrama. Reservando el techo del modelo
   * no puede pasar en ninguna tonalidad.
   *
   * Y además es lo que hace un cancionero: el cifrado va siempre a la misma altura
   * sobre el pentagrama, no bailando con la melodía.
   */
  const escalonMasAlto = writeNote(
    { id: 'techo', offset: MAX_OFFSET, start: 0, length: 1 },
    tonic,
    mode,
  ).step;
  const respiro = Math.max(0, 26 - (yDeStep(escalonMasAlto) - CABEZA_RY - 2));

  const compases = Math.max(1, bars);

  /**
   * El ancho de la caja, medido.
   *
   * Un `ResizeObserver` y no un porcentaje de CSS: hace falta el número para
   * repartir los pulsos, y un SVG escalado con `width: 100%` estiraría también
   * las notas y la clave hasta deformarlas.
   */
  const { ref: cajaRef, medida } = useMedida<HTMLDivElement>();
  const { sistemas, porSistema, porPulso } = repartoEnSistemas(
    medida.ancho,
    margen,
    compases,
    beatsPerBar,
  );
  /** Los pulsos de un sistema entero; el último puede llevar menos. */
  const pulsosPorSistema = porSistema * beatsPerBar;
  const ancho = margen + pulsosPorSistema * porPulso + 8;
  /** Lo que mide de alto cada sistema, con su aire para los cifrados y las agudas. */
  const altoSistema = ALTO + respiro;

  /**
   * En qué sistema y a qué altura de él cae un pulso.
   *
   * `fin` es para lo que **acaba** en ese pulso: un acorde que termina justo en
   * la barra del final de un sistema acaba en ese sistema, no al principio del
   * siguiente.
   */
  function lugar(pulso: number, fin = false): { s: number; x: number } {
    const cuenta = fin
      ? Math.ceil(pulso / pulsosPorSistema) - 1
      : Math.floor(pulso / pulsosPorSistema);
    const s = Math.min(sistemas - 1, Math.max(0, cuenta));
    return { s, x: margen + (pulso - s * pulsosPorSistema) * porPulso };
  }
  /** Dónde acaba la música de un sistema: el último suele ir más corto. */
  const finDe = (s: number) =>
    margen + Math.min(porSistema, compases - s * porSistema) * beatsPerBar * porPulso;
  /** Lo que baja un sistema desde el primero. */
  const bajada = (s: number) => (s === 0 ? undefined : `translate(0 ${s * altoSistema})`);
  /**
   * Donde va la pista del pentagrama vacío: **centrada bajo la música del primer
   * sistema**, y apartada de los bordes si la hoja es más estrecha que ella. Iba
   * pegada a la clave.
   */
  const xPista = Math.min(
    Math.max((margen + finDe(0)) / 2, ANCHO_PISTA / 2 + 4),
    Math.max(ANCHO_PISTA / 2 + 4, ancho - 4 - ANCHO_PISTA / 2),
  );

  /** Qué escalón y qué pulso hay bajo un punto de la pantalla. */
  const sitioEn = useCallback(
    (clientX: number, clientY: number): { step: number; start: number } => {
      /* v8 ignore next -- el pentagrama está montado: sin él no hay dónde pulsar. */
      const caja = svgRef.current?.getBoundingClientRect() ?? SIN_PENTAGRAMA;
      // El SVG se dibuja a su tamaño natural, así que un píxel de pantalla es un
      // píxel del dibujo. Si algún día se escala, aquí hay que dividir por la
      // razón entre `caja.width` y `ancho`.
      const x = clientX - caja.left;
      // Primero qué sistema, por la altura: cada uno mide lo mismo.
      const s = Math.min(sistemas - 1, Math.max(0, Math.floor((clientY - caja.top) / altoSistema)));
      // El `viewBox` empieza en `-respiro`, así que el cero de pantalla no es el
      // cero del dibujo. Sin esta resta, escribir sobre una partitura con notas
      // agudas pone la nota tantos escalones más abajo como aire se haya abierto.
      const y = clientY - caja.top - respiro - s * altoSistema;
      return {
        step: Math.round((BASE - y) / PASO) + STEP_BASE,
        start: s * pulsosPorSistema + Math.max(0, Math.round((x - margen) / porPulso / 0.5) * 0.5),
      };
    },
    // El margen entra aquí desde que depende de la tonalidad: en Fa sostenido
    // hay seis sostenidos delante, y con el número de Do mayor cada nota que se
    // escribe caería medio compás a la izquierda de donde se pulsó.
    [porPulso, margen, respiro, sistemas, altoSistema, pulsosPorSistema],
  );

  /**
   * Arrastrar un cifrado para cambiarlo de sitio.
   *
   * Era lo único que había que ir a hacer a la otra vista, y no tenía sentido:
   * en una partitura los acordes están ahí escritos y moverlos es el gesto
   * evidente. Se mueve **por compases**, contando cuántos acordes caben antes de
   * donde se suelta, que es lo que en esta vista significa «antes».
   */
  const moverAcorde = useCallback(
    (event: ReactPointerEvent<SVGGElement>, blockId: string) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      onGestureStart();

      empezarArrastre({
        mover: (x, y) => {
          arrastradaRef.current = true;
          const sitio = sitioEn(x, y);
          // Cuántos acordes empiezan antes del pulso donde está el puntero.
          let desde = 0;
          let destino = 0;
          for (const block of blocks) {
            if (sitio.start < desde + block.beats / 2) {
              break;
            }
            desde += block.beats;
            destino += 1;
          }
          onMoveBlock(blockId, destino);
        },
        soltar: onGestureEnd,
      });
    },
    [blocks, empezarArrastre, onGestureEnd, onGestureStart, onMoveBlock, sitioEn],
  );

  /**
   * Estirar un acorde tirando del final de su línea.
   *
   * En esta vista no hay bloques que agarrar por el borde, y sin esto el único
   * sitio donde se puede cambiar lo que dura un acorde sería la otra vista. La
   * línea que va bajo el cifrado ya dice hasta dónde llega; tirar de su punta es
   * el gesto que le corresponde.
   */
  const estirarAcorde = useCallback(
    (event: ReactPointerEvent<SVGGElement>, blockId: string, beats: number) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      const inicioX = event.clientX;
      onGestureStart();
      empezarArrastre({
        mover: (x) => {
          arrastradaRef.current = true;
          onResizeBlock(blockId, beats + (x - inicioX) / porPulso);
        },
        soltar: onGestureEnd,
      });
    },
    [empezarArrastre, onGestureEnd, onGestureStart, onResizeBlock, porPulso],
  );

  /**
   * Arrastrar una nota por el pentagrama.
   *
   * Se mueve por **escalones**, no por semitonos: subir una línea da la nota que
   * la armadura dice que va ahí. Para las alteradas están las teclas de más y
   * menos, que suman y restan un semitono sin cambiarla de sitio.
   */
  const cogerNota = useCallback(
    (event: ReactPointerEvent<SVGGElement>, note: LeadNote) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      onSelect(note.id);
      onGestureStart();

      // **La nota se mueve con el puntero, no salta a él.** Se guarda la
      // distancia entre donde se cogió y donde está, y se conserva durante todo
      // el gesto. Sin esto, cogerla por el final de la plica la mandaba de golpe
      // tres líneas más abajo antes de empezar a moverla.
      const agarre = sitioEn(event.clientX, event.clientY);
      const escrita = writeNote(note, tonic, mode);
      const dStep = escrita.step - agarre.step;
      const dStart = note.start - agarre.start;

      empezarArrastre({
        mover: (x, y) => {
          arrastradaRef.current = true;
          const sitio = sitioEn(x, y);
          onMove(note.id, sitio.start + dStart, offsetOfStep(sitio.step + dStep, tonic, mode));
        },
        soltar: onGestureEnd,
      });
    },
    [empezarArrastre, mode, onGestureEnd, onGestureStart, onMove, onSelect, sitioEn, tonic],
  );

  return (
    // **La partitura es una hoja**, no un dibujo flotando en la pantalla.
    //
    // Estaba sobre el mismo negro que todo lo demás, y una partitura sin papel
    // debajo no se lee como una partitura: se lee como cinco rayas sueltas. Con
    // la superficie de siempre —fondo un punto más claro, filo de luz arriba y
    // sombra debajo— pasa a ser algo apoyado sobre la mesa, que es lo que el
    // proyecto ya hace con todo lo que se mira.
    /*
      Dos cajas y no una, y la de fuera **no puede ser el papel**.

      La de fuera es la que se mide para repartir los pulsos, así que tiene que
      ocupar todo el ancho disponible. La de dentro es la hoja, y esa mide lo que
      la música: a todo lo ancho quedaba media hoja en blanco a la derecha del
      último acorde, que se lee como que falta algo.

      Juntarlas en una sola con `w-fit` se muerde la cola: el observador mediría
      el contenido en vez del hueco, el reparto saldría más estrecho, el contenido
      encogería, y así hasta el pulso mínimo. Se vio: la partitura se quedó a la
      mitad de ancho.
    */
    // El desplazamiento de lado se queda solo para lo que no se puede partir: un
    // compás de seis a su pulso mínimo no cabe en un teléfono de 320, y un
    // compás no se parte en dos renglones.
    <div ref={cajaRef} className="mt-1">
      <div className="superficie w-fit max-w-full overflow-x-auto px-2 py-1">
        <svg
          ref={svgRef}
          width={ancho}
          height={sistemas * altoSistema}
          viewBox={`0 ${-respiro} ${ancho} ${sistemas * altoSistema}`}
          // Un grupo y no una imagen: los hijos de una imagen son decoración por
          // definición, y aquí dentro están los acordes y las notas, que se
          // eligen. Con `img` el lector no los anunciaba y axe lo marca como
          // interactivos anidados (`docs/ESTILO.md`, lo mismo que la rueda).
          role="group"
          aria-label={`Partitura de ${partName}: ${notes.length} notas`}
          className="text-text block"
          onClick={(event) => {
            if (arrastradaRef.current) {
              arrastradaRef.current = false;
              return;
            }
            const sitio = sitioEn(event.clientX, event.clientY);
            onAdd(offsetOfStep(sitio.step, tonic, mode), sitio.start);
          }}
        >
          {/*
            Un sistema por línea, y **cada uno empieza con su clave y su
            armadura**, que es como se lee una partitura de varias líneas: quien
            salta al segundo renglón no tiene que volver al primero para saber en
            qué tonalidad está. La indicación de compás va solo en el primero,
            como en cualquier partitura impresa.
          */}
          {Array.from({ length: sistemas }, (_, s) => {
            const fin = finDe(s);
            const ultimo = s === sistemas - 1;
            const compasesAqui = Math.min(porSistema, compases - s * porSistema);
            return (
              <g key={s} transform={bajada(s)} data-sistema={s}>
                {/* Las cinco líneas, hasta la barra que cierra el sistema. */}
                {[0, 1, 2, 3, 4].map((linea) => (
                  <line
                    key={linea}
                    x1={4}
                    x2={fin}
                    y1={BASE - linea * 2 * PASO}
                    y2={BASE - linea * 2 * PASO}
                    stroke="currentColor"
                    // Las cinco líneas son la referencia contra la que se lee todo lo
                    // demás: apagadas al 45 % se veían como una sugerencia de
                    // pentagrama. Se probó a ponerle fondo claro al dibujo, como hace
                    // Soundslice con su papel, y en una aplicación oscura con identidad
                    // propia el rectángulo blanco canta más de lo que ayuda: lo que le
                    // faltaba a la partitura era contraste, no papel.
                    strokeOpacity={0.7}
                    strokeWidth={1}
                  />
                ))}

                {/*
                  La clave de sol.

                  El dibujo vive en `clef.ts`, y allí está el porqué: se genera a partir
                  de la línea que recorre la pluma en vez de escribirse curva a curva,
                  que es como salió la primera —una espiral con un palo, sin los dos
                  cruces que hacen la clave—.

                  Aquí solo se coloca, y colocarla es **una traslación y nada más**: las
                  coordenadas de la clave tienen el centro de la espiral en el origen, y
                  ese centro va sobre la línea del Sol, que es lo único que la clave
                  significa. Antes había que restarle a la línea el 101 de la caja de
                  dibujo multiplicado por la escala, y ese 101 no lo sabía nadie.
                */}
                <g
                  aria-hidden
                  transform={`translate(${MARGEN_CLAVE} ${BASE - 2 * PASO}) scale(${ESCALA_CLAVE})`}
                  fill="currentColor"
                  fillOpacity={0.85}
                >
                  <path d={CLAVE_DE_SOL} />
                  <circle cx={BOLITA.x} cy={BOLITA.y} r={BOLITA.r} />
                </g>

                {/* La armadura, en el orden en que se escribe. */}
                {armadura.letters.map((letra, indice) => (
                  <text
                    key={letra}
                    x={CLAVE_HASTA + indice * PASO_ARMADURA}
                    y={
                      // Toda letra de una armadura tiene altura: las dos tablas llevan
                      // las siete. El seis es para que TypeScript se quede tranquilo.
                      yDeStep(
                        /* v8 ignore next -- las dos tablas llevan las siete letras */
                        (armadura.accidental === 'sharp' ? ALTURA_SOSTENIDOS : ALTURA_BEMOLES)[
                          letra
                        ] ?? 6,
                      ) + 4
                    }
                    fontSize={14}
                    fill="currentColor"
                    fillOpacity={0.75}
                    aria-hidden
                  >
                    {armadura.accidental === 'sharp' ? '♯' : '♭'}
                  </text>
                ))}

                {/*
                  La indicación de compás, solo en el primer sistema.

                  Faltaba, y sin ella el pentagrama no dice en cuánto se cuenta: los
                  pulsos por compás se eligen arriba en la barra y la partitura era el
                  único sitio donde ese número no aparecía.

                  El de abajo es siempre un cuatro porque el modelo cuenta en negras: un
                  pulso es una negra en `melody.ts`, y mientras eso sea así escribir otra
                  cosa sería mentir. Cada cifra llena su mitad del pentagrama
                  (`CIFRAS_DEL_COMPAS`).
                */}
                {s === 0 && (
                  <g
                    aria-hidden
                    fill="currentColor"
                    fillOpacity={0.9}
                    fontSize={CIFRAS_DEL_COMPAS.cuerpo}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    <text x={margen - ANCHO_COMPAS / 2 - 6} y={CIFRAS_DEL_COMPAS.baseArriba}>
                      {beatsPerBar}
                    </text>
                    <text x={margen - ANCHO_COMPAS / 2 - 6} y={CIFRAS_DEL_COMPAS.baseAbajo}>
                      4
                    </text>
                  </g>
                )}

                {/*
                  Las barras de compás.

                  Estaban al 0,5 de opacidad, más apagadas que las propias líneas del
                  pentagrama, que van al 0,7. Una divisoria más tenue que aquello que
                  divide no se lee como divisoria: se lee como una raya que sobra.

                  Y solo van **entre** compases. Había una pegada al principio, antes de
                  la primera nota, que ninguna partitura impresa lleva: un sistema empieza
                  con la clave y ya está. Con la indicación de compás delante, aquella
                  raya dejaba la música dentro de una caja.

                  Un sistema que no es el último acaba en una divisoria sencilla: la
                  música sigue en el renglón de abajo.
                */}
                {Array.from({ length: ultimo ? compasesAqui - 1 : compasesAqui }, (_, i) => (
                  <line
                    key={i}
                    x1={margen + (i + 1) * beatsPerBar * porPulso}
                    x2={margen + (i + 1) * beatsPerBar * porPulso}
                    y1={BASE - 8 * PASO}
                    y2={BASE}
                    stroke="currentColor"
                    strokeOpacity={0.7}
                  />
                ))}

                {/*
                  La barra final: fina y luego gruesa, que es como acaba una partitura.

                  Antes el final era una divisoria más, así que la última parte parecía
                  cortada en vez de terminada.
                */}
                {ultimo && (
                  <g aria-hidden stroke="currentColor" strokeOpacity={0.85}>
                    <line x1={fin - 5} x2={fin - 5} y1={BASE - 8 * PASO} y2={BASE} />
                    <line
                      x1={fin - 1.5}
                      x2={fin - 1.5}
                      y1={BASE - 8 * PASO}
                      y2={BASE}
                      strokeWidth={3}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/*
          Los cifrados, que aquí **son** los acordes y no su etiqueta.

          En esta vista no hay tira de bloques, así que el cifrado es lo único que
          queda del acorde: se pulsa para elegirlo, las flechas lo mueven y lo
          estiran y se quita con `Supr`, igual que un bloque. Debajo lleva una
          línea que dice hasta dónde llega, que es lo que un cifrado suelto no
          dice y un bloque decía con su ancho.
        */}
          <g transform={`translate(0 ${-respiro})`}>
            {
              blocks.reduce<{ x: number; nodos: React.ReactElement[]; i: number }>(
                (acumulado, block) => {
                  const indice = acumulado.i;
                  const chord = blockChord(tonic, mode, block);
                  const inicio = lugar(acumulado.x);
                  const final = lugar(acumulado.x + block.beats, true);
                  const x = inicio.x;
                  const elegido = selectedBlockId === block.id;
                  /*
                    La línea de lo que dura, **un tramo por sistema que pisa**.
                    Un acorde que cruza el final de un renglón sigue en el de
                    abajo, como una ligadura que salta de línea: tirada entera en
                    el primero se saldría de la hoja por la derecha.
                  */
                  const tramos = Array.from({ length: final.s - inicio.s + 1 }, (_, i) => {
                    const s = inicio.s + i;
                    return {
                      s,
                      desde: s === inicio.s ? inicio.x : margen,
                      hasta: s === final.s ? final.x - 4 : finDe(s),
                    };
                  });
                  /* v8 ignore next -- siempre hay al menos un tramo: el del sistema donde empieza */
                  const primero = tramos[0] ?? { s: 0, desde: x, hasta: x };

                  acumulado.nodos.push(
                    <g
                      key={block.id}
                      role="button"
                      tabIndex={0}
                      // El compás es zona de destino: al arrastrar un acorde por
                      // encima, el hueco que se abre es el de aquí.
                      data-parte={partId}
                      data-indice={acumulado.x === 0 ? 0 : indice}
                      data-bloque={block.id}
                      aria-label={`${chord.symbol}, grado ${block.degree}, ${block.beats} pulsos`}
                      aria-pressed={elegido}
                      // `pan-y` y no `none`: el cifrado se mueve de lado —por
                      // compases— y eso lo deja hacer; un barrido de arriba abajo
                      // que nazca en él sigue siendo desplazar la columna, que es
                      // lo que un dedo quiere decir casi siempre sobre una hoja.
                      // Si el navegador se lo queda, llega `pointercancel` y el
                      // gesto se suelta.
                      style={{ touchAction: 'pan-y' }}
                      className={`focus-visible:outline-brass-bright cursor-grab select-none focus-visible:outline-2 ${
                        elegido ? 'text-brass-bright' : ''
                      }`}
                      onPointerDown={(event) => moverAcorde(event, block.id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectBlock(block.id);
                      }}
                      onKeyDown={(event) => {
                        if (activa(event)) {
                          onSelectBlock(block.id);
                        } else {
                          onBlockKeyDown(event, block.id);
                        }
                      }}
                    >
                      {/* El cifrado, con peso: en esta vista **es** el acorde, no su
                      etiqueta, y a catorce píxeles al 85 % se leía como un pie de
                      foto al lado de un pentagrama que ocupa cinco veces más.
                      Dieciséis, el cuerpo de la casa: a un metro los quince se
                      quedaban cortos. */}
                      <text
                        x={x}
                        y={17}
                        transform={bajada(inicio.s)}
                        fontSize={16}
                        fontWeight={600}
                        fontFamily="ui-monospace, monospace"
                        fill="currentColor"
                        fillOpacity={elegido ? 1 : 0.95}
                      >
                        {chord.symbol}
                      </text>
                      {tramos.map((tramo) => (
                        <line
                          key={tramo.s}
                          x1={tramo.desde}
                          x2={tramo.hasta}
                          y1={22}
                          y2={22}
                          transform={bajada(tramo.s)}
                          stroke="currentColor"
                          strokeOpacity={elegido ? 0.9 : 0.3}
                          strokeWidth={elegido ? 2 : 1}
                        />
                      ))}
                      {/* La zona de agarre del cifrado: `ALTO_DEL_AGARRE`, los
                        44 px de la casa. Es lo que se pulsa para elegir un acorde
                        y lo que se arrastra para moverlo, y medía 29 en pantalla.

                        Crece hacia abajo y no hacia arriba porque arriba no hay
                        nada: la banda de cifrados es el borde del cuadro. Hacia
                        abajo está el aire de las notas agudas, y lo que se cede
                        está contado en `ALTO_DEL_AGARRE`. A los lados sigue
                        acorralado por el cifrado siguiente. */}
                      <rect
                        x={x - 2}
                        y={4}
                        transform={bajada(inicio.s)}
                        width={Math.max(24, primero.hasta - primero.desde - 10)}
                        height={ALTO_DEL_AGARRE}
                        fill="transparent"
                      />
                      {/* La punta de la línea: de aquí se tira para estirar. Va
                          donde acaba, que puede ser otro sistema. */}
                      <rect
                        x={final.x - 16}
                        y={4}
                        transform={bajada(final.s)}
                        width={16}
                        height={ALTO_DEL_AGARRE}
                        fill="transparent"
                        className="cursor-ew-resize"
                        onPointerDown={(event) => estirarAcorde(event, block.id, block.beats)}
                      />
                    </g>,
                  );
                  return {
                    x: acumulado.x + block.beats,
                    nodos: acumulado.nodos,
                    i: acumulado.i + 1,
                  };
                },
                { x: 0, nodos: [], i: 0 },
              ).nodos
            }
          </g>

          {/* La marca de dónde caería el acorde que se arrastra. Va donde empieza
            el compás ante el que se soltaría, que es donde va a aparecer. */}
          {dropAt !== null &&
            (() => {
              const caeria = lugar(blocks.slice(0, dropAt).reduce((suma, b) => suma + b.beats, 0));
              return (
                <line
                  aria-hidden
                  x1={caeria.x - 3}
                  x2={caeria.x - 3}
                  transform={bajada(caeria.s)}
                  y1={2}
                  y2={BASE + 4}
                  className="stroke-brass-bright"
                  strokeWidth={2}
                />
              );
            })()}

          {/* **Un pentagrama vacío no dice qué espera.** Con la canción escrita
              solo con acordes —que es el caso normal al empezar— aquí salen los
              cifrados arriba y cinco líneas en blanco debajo, y la vista por
              defecto es esta a propósito: la partitura no es un extra. Quien lee
              partituras entiende una hoja guía sin melodía; quien no, ve una
              pantalla rota. Se dice en el hueco y no en un cartel aparte, porque
              el sitio donde se escribe es justo este.

              `pointer-events-none` porque pulsar el pentagrama **es** como se
              escribe una nota: un rótulo que se comiera el clic convertiría la
              ayuda en un estorbo. */}
          {/* **En dos líneas, a doce y centrada bajo la música.** En una sola
              medía unos doscientos ochenta píxeles, y en un teléfono con un
              compás o dos la hoja mide menos: la frase se cortaba contra el
              borde. Un SVG no parte el texto solo, así que se parte a mano.
              Iba a once píxeles y arrancando pegada a la clave, donde se leía
              como un pie de la clave y no como algo del hueco donde se escribe;
              centrada debajo del primer sistema dice «aquí», y si la hoja es
              más estrecha que la frase se aparta de los dos bordes. */}
          {notes.length === 0 && (
            <text
              x={xPista}
              y={BASE + BAJO_LA_PAUTA}
              textAnchor="middle"
              fontSize={CUERPO_PISTA}
              className="fill-text-muted pointer-events-none"
            >
              {/* El espacio entre las dos, suelto: un lector junta el texto de
                  los `tspan` sin separarlos, y oía «pentagramay aquí». Partir el
                  renglón es cosa del dibujo, no de la frase. */}
              <tspan>Pulsa en el pentagrama</tspan>{' '}
              <tspan x={xPista} dy={CUERPO_PISTA + 3}>
                y aquí se escribe el punteo.
              </tspan>
            </text>
          )}

          {notes.map((note) => {
            const escrita = writeNote(note, tonic, mode);
            // Cada nota en el sistema donde empieza; una que cruza el final del
            // renglón se dibuja ahí y lo cruza, igual que cruza una barra.
            const sitio = lugar(note.start);
            const x = sitio.x + 6;
            const y = yDeStep(escrita.step);
            const { hueca, plica, corchetes, punto } = figuraDe(note.length);
            const arriba = escrita.step < 6;

            /*
              Qué alteración se escribe delante de la nota, que **no es la que
              trae el nombre**.

              La armadura ya altera todas las notas de esas letras, así que un Si
              bemol en Mi bemol mayor no lleva bemol propio: lo lleva la armadura,
              y repetirlo delante de cada nota llena el pentagrama de bemoles que
              un músico no espera. Estaba escribiéndolos todos.

              Y al revés: una letra que la armadura altera, tocada al natural,
              necesita un becuadro o se lee alterada. No se dibujaba ninguno.
            */
            const laArmaduraLaAltera = armadura.letters.includes(escrita.letter);
            const alteracionDeArmadura = armadura.accidental === 'sharp' ? '#' : 'b';
            const alteracion = laArmaduraLaAltera
              ? escrita.accidental === alteracionDeArmadura
                ? ''
                : escrita.accidental === ''
                  ? '♮'
                  : // Una letra que la armadura altera no se escribe nunca con la
                    // alteración contraria: en Sol mayor un «Fa bemol» sale
                    // escrito Mi, y en Fa un «Si sostenido» sale Do. Lo decide
                    // `writeNote`, y esto es el por si acaso.
                    /* v8 ignore next 3 -- `writeNote` no devuelve la alteracion contraria a la armadura */
                    escrita.accidental === '#'
                    ? '♯'
                    : '♭'
              : escrita.accidental === '#'
                ? '♯'
                : escrita.accidental === 'b'
                  ? '♭'
                  : '';
            const seleccionada = selectedNoteId === note.id;
            const dudosa = isDoubtfulNote(note);

            return (
              <g
                key={note.id}
                transform={bajada(sitio.s)}
                role="button"
                tabIndex={0}
                data-nota={note.id}
                aria-label={`${escrita.letter}${escrita.accidental}${escrita.octave}, ${note.length} pulsos, en el pulso ${note.start}${dudosa ? ', dudosa' : ''}`}
                className="focus-visible:outline-brass-bright cursor-grab rounded-sm focus-visible:outline-2"
                // Aquí sí `none`: una nota se mueve en las dos direcciones
                // —de pulso y de altura— y no hay eje que cederle al
                // navegador. Es una cabeza con su plica en una hoja que por
                // lo demás se desplaza, no una tira tapada de notas.
                style={{ touchAction: 'none' }}
                onPointerDown={(event) => cogerNota(event, note)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(note.id);
                }}
                onKeyDown={(event) => {
                  if (activa(event)) {
                    onSelect(note.id);
                  }
                }}
              >
                {/* Las líneas adicionales, para lo que se sale del pentagrama. */}
                {escrita.step > 10 &&
                  Array.from({ length: Math.floor((escrita.step - 10) / 2) }, (_, i) => (
                    <line
                      key={`a${i}`}
                      x1={x - LARGO_ADICIONAL}
                      x2={x + LARGO_ADICIONAL}
                      y1={yDeStep(12 + i * 2)}
                      y2={yDeStep(12 + i * 2)}
                      stroke="currentColor"
                      strokeOpacity={0.7}
                    />
                  ))}
                {escrita.step < 2 &&
                  Array.from({ length: Math.floor((2 - escrita.step) / 2) }, (_, i) => (
                    <line
                      key={`b${i}`}
                      x1={x - LARGO_ADICIONAL}
                      x2={x + LARGO_ADICIONAL}
                      y1={yDeStep(0 - i * 2)}
                      y2={yDeStep(0 - i * 2)}
                      stroke="currentColor"
                      strokeOpacity={0.7}
                    />
                  ))}

                {alteracion !== '' && (
                  <text x={x - CABEZA_MEDIO_ANCHO - 9} y={y + 5} fontSize={14} fill="currentColor">
                    {alteracion}
                  </text>
                )}

                {/* La cabeza va inclinada, como en cualquier partitura: es lo que
                  la distingue de un punto y lo que la hace caber entre dos
                  líneas que están a cinco píxeles. */}
                {seleccionada && (
                  <circle
                    cx={x}
                    cy={y}
                    r={9}
                    className="fill-brass-dim"
                    fillOpacity={0.35}
                    aria-hidden
                  />
                )}
                <ellipse
                  cx={x}
                  cy={y}
                  rx={CABEZA_RX}
                  ry={CABEZA_RY}
                  transform={`rotate(-${INCLINACION} ${x} ${y})`}
                  fill={hueca ? 'none' : 'currentColor'}
                  stroke="currentColor"
                  strokeWidth={hueca ? 1.6 : 1}
                  className={seleccionada ? 'text-brass-bright' : ''}
                />
                {/* El puntillo va detrás de la cabeza y **siempre en un espacio**:
                  puesto sobre una línea se confunde con ella. Si la nota está en
                  línea —los `step` pares—, sube al espacio de encima. */}
                {punto && (
                  <circle
                    cx={x + CABEZA_MEDIO_ANCHO + 4}
                    cy={escrita.step % 2 === 0 ? y - PASO : y}
                    r={1.6}
                    fill="currentColor"
                  />
                )}

                {/* Una nota que llegó sucia se marca con un interrogante pequeño
                  encima, igual que un acorde dudoso lo lleva al lado. No con
                  color: los colores de esta pantalla ya dicen otra cosa. */}
                {dudosa && (
                  <text
                    x={x - 3}
                    y={arriba ? y + 16 : y - 12}
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.6}
                    aria-hidden
                  >
                    ?
                  </text>
                )}

                {plica && (
                  <line
                    x1={arriba ? x + CABEZA_MEDIO_ANCHO : x - CABEZA_MEDIO_ANCHO}
                    x2={arriba ? x + CABEZA_MEDIO_ANCHO : x - CABEZA_MEDIO_ANCHO}
                    y1={y}
                    y2={arriba ? y - PLICA_LARGO : y + PLICA_LARGO}
                    stroke="currentColor"
                    strokeWidth={1.3}
                  />
                )}
                {/* Uno por corchete, separados por su hueco: es como se lee «esto
                    dura la mitad otra vez». El segundo baja por la plica, que es
                    donde va en una partitura de verdad. */}
                {Array.from({ length: corchetes }, (_, cual) => (
                  <path
                    key={cual}
                    d={
                      arriba
                        ? `M ${x + CABEZA_MEDIO_ANCHO} ${y - PLICA_LARGO + cual * SEPARACION_CORCHETES} q 9 5 8 14`
                        : `M ${x - CABEZA_MEDIO_ANCHO} ${y + PLICA_LARGO - cual * SEPARACION_CORCHETES} q 9 -5 8 -14`
                    }
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  />
                ))}

                {/*
                La zona de agarre, en dos piezas: una sobre la cabeza y otra a lo
                largo de la plica.

                Invisible y mucho mayor que lo que se ve, porque una cabeza de
                cinco píxeles no se coge con el dedo. Y la plica cuenta: es la
                mitad de la altura de la nota, y quien va a cogerla apunta a la
                figura entera, no a la elipse de abajo.
              */}
                <rect
                  x={x - CABEZA_MEDIO_ANCHO - 3}
                  y={y - CABEZA_RY - 3}
                  width={Math.max(CABEZA_MEDIO_ANCHO * 2 + 6, note.length * porPulso)}
                  height={CABEZA_RY * 2 + 6}
                  fill="transparent"
                />
                {plica && (
                  <rect
                    x={arriba ? x : x - CABEZA_MEDIO_ANCHO - 3}
                    y={arriba ? y - PLICA_LARGO : y}
                    width={CABEZA_MEDIO_ANCHO + 3}
                    height={PLICA_LARGO}
                    fill="transparent"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});
