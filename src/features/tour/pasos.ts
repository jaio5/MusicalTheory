import type { EspacioDeTrabajo } from '@state/workspace';

/**
 * Los pasos del recorrido de la primera visita, en el orden en que se enseñan.
 *
 * Es **dato y no componente** a propósito: lo que se dice en cada paso, qué pieza
 * se señala y qué hay que preparar para verla se lee de arriba abajo aquí, sin
 * buscarlo entre efectos. Quien cambie de sitio una pieza de la pantalla tiene
 * que venir aquí, y el test de los pasos le dice si se ha dejado alguno sin
 * pieza que señalar.
 *
 * Las piezas se buscan por `data-tour`, que es un nombre estable puesto a mano en
 * cada una, y donde la pieza ya lleva un nombre que nadie va a cambiar —las áreas
 * del banco, la navegación— por ese nombre. **Nunca por su clase ni por su
 * posición**: eso cambia con cada retoque de la pantalla y el recorrido se
 * quedaría señalando el aire.
 */

export type Seccion = 'Bienvenida' | 'Aprender' | 'Profesor' | 'Componer' | 'Afinar';

export interface Paso {
  /** Su nombre, que es lo que se guarda: el número cambia con el ancho. */
  readonly id: string;
  readonly seccion: Seccion;
  readonly titulo: string;
  /** Dos frases como mucho, y sin jerga. */
  readonly texto: string;
  /** Lo que dice en un teléfono, si allí la pieza está en otro sitio. */
  readonly textoMovil?: string;
  /** La pantalla en la que vive la pieza. Sin ella, la que haya. */
  readonly ruta?: string;
  /**
   * Dónde está la pieza: selectores separados por comas, y vale **el primero
   * que se vea**. Así un mismo paso señala la rueda del banco en un portátil y
   * la barra que flota en un teléfono. Sin objetivo, la tarjeta sale en medio.
   */
  readonly objetivo?: string;
  /** Cómo se llama la pieza al anunciarla, para quien no la ve. */
  readonly nombre?: string;
  /** En componer, el espacio que tiene que estar puesto para verla. */
  readonly espacio?: EspacioDeTrabajo;
  /** Solo hay banco desde `lg`: sin él, el paso no existe. */
  readonly soloEnElBanco?: boolean;
  /** Solo en un teléfono o una tableta, donde no hay banco. */
  readonly soloSinBanco?: boolean;
  /**
   * Si la pieza tiene algo que flota fuera de su caja —el panel de la rueda—
   * y hay que señalarlo también.
   */
  readonly conLoQueFlota?: boolean;
  /**
   * Si para enseñarlo hace falta una tonalidad. Sin ella componer solo enseña
   * «elige una», así que el recorrido pone Do mayor y la quita al acabar.
   */
  readonly necesitaTonalidad?: boolean;
}

export const PASOS: readonly Paso[] = [
  {
    id: 'bienvenida',
    seccion: 'Bienvenida',
    titulo: 'Bienvenido a Caos ordenado',
    texto:
      'En un par de minutos te enseño dónde está cada cosa: aprender, el profesor, componer y afinar. Puedes saltarlo cuando quieras.',
  },
  {
    id: 'pantallas',
    seccion: 'Bienvenida',
    titulo: 'Las cuatro pantallas',
    texto: 'Desde aquí pasas de una a otra cuando quieras. Empezamos por Aprender.',
    objetivo: 'nav[aria-label="Pantallas"], nav[aria-label="Pantallas, abajo"]',
    nombre: 'la navegación entre pantallas',
  },
  {
    id: 'aprender-hoy',
    seccion: 'Aprender',
    ruta: '/aprender',
    titulo: 'Tu meta y por dónde seguir',
    texto:
      'Arriba ves lo que llevas hoy, y el botón grande te lleva a la siguiente unidad. Con «Empiezo por» saltas al curso que quieras.',
    objetivo: '[data-tour="aprender-hoy"]',
    nombre: 'la meta de hoy y el botón de seguir',
  },
  {
    id: 'aprender-camino',
    seccion: 'Aprender',
    ruta: '/aprender',
    titulo: 'El camino',
    texto:
      'Diez cursos de teoría, de oído y de tocar con la guitarra, en orden. Cada unidad se abre al terminar la anterior.',
    // El primer curso y no el camino entero: en un teléfono el camino mide
    // varias pantallas, y señalarlo entero era encender la pantalla completa.
    objetivo: '[data-tour="aprender-camino"] ol > li:first-child, [data-tour="aprender-camino"]',
    nombre: 'el camino de cursos',
  },
  {
    id: 'profesor',
    seccion: 'Profesor',
    ruta: '/profesor',
    titulo: 'El profesor',
    texto:
      'Pregúntale teoría con tus palabras y te contesta en tres frases, con la tonalidad que tengas puesta: los ejemplos salen con tus acordes. Necesita una cuenta, y si aquí no las hay, la pantalla te lo dice.',
    objetivo: '[data-tour="profesor-pregunta"]',
    nombre: 'la pregunta al profesor',
  },
  {
    id: 'componer-tonalidad',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'tocando',
    titulo: 'Componer empieza por la tonalidad',
    texto:
      'De ella salen los acordes que caben y a dónde puede ir cada uno: se elige en la rueda. Si no tienes ninguna, para el recorrido pongo Do mayor.',
    textoMovil:
      'De ella sale todo, y en el teléfono se elige aquí arriba, en la rueda. Si no tienes ninguna, para el recorrido pongo Do mayor.',
    objetivo: '[data-tour="componer-tonalidad"], section[aria-label="Tonalidad"]',
    nombre: 'la tonalidad y su rueda',
    conLoQueFlota: true,
  },
  {
    id: 'componer-espacios',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'tocando',
    necesitaTonalidad: true,
    titulo: 'Tres maneras de escribir',
    texto: 'Tocando, Escribir y Ensayar son tres caminos a la misma canción. Te enseño cada uno.',
    objetivo: '[data-tour="componer-espacios"]',
    nombre: 'los tres espacios de trabajo',
  },
  {
    id: 'componer-papel',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'tocando',
    necesitaTonalidad: true,
    titulo: 'Tocando: qué vas a tocar',
    texto:
      'Rítmica apunta los acordes, punteo apunta las notas sueltas, y solo grabar guarda el sonido sin escribir nada. Se elige antes de empezar.',
    objetivo: '[data-tour="componer-papel"]',
    nombre: 'qué vas a tocar',
  },
  {
    id: 'componer-tocar',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'tocando',
    necesitaTonalidad: true,
    titulo: 'Tocar y parar',
    texto:
      'Al pulsar Tocar suenan dos compases de cuenta y el clic te acompaña toda la toma; aquí lo quitas o lo bajas. Al parar, lo que tocaste entra en la canción.',
    objetivo: '[data-tour="componer-tocar"]',
    nombre: 'el clic y el botón de tocar',
  },
  {
    id: 'componer-cancion',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'escribir',
    necesitaTonalidad: true,
    titulo: 'Escribir: la canción en bloques',
    texto:
      'Cada acorde es un bloque: arrástralo para moverlo y estira su borde para que dure más. La canción se hace de partes, una debajo de otra.',
    objetivo: '[data-tour="componer-cancion"]',
    nombre: 'la canción',
  },
  {
    id: 'componer-anadir',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'escribir',
    necesitaTonalidad: true,
    titulo: 'Añadir acordes',
    texto:
      'Pulsa uno de la lista y entra al final, o arrástralo a donde lo quieras. Van ordenados por lo bien que siguen a lo que llevas.',
    objetivo: '[data-tour="componer-que-poner"]',
    nombre: 'qué poner ahora',
  },
  {
    id: 'componer-barra',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'escribir',
    necesitaTonalidad: true,
    titulo: 'Escuchar, ver y deshacer',
    texto:
      '«Escuchar la canción» la toca entera, y aquí eliges verla en partitura o en bloques. «Deshacer» aparece en cuanto escribes algo.',
    objetivo: '[data-tour="componer-barra-del-lienzo"]',
    nombre: 'la barra de la canción',
  },
  {
    id: 'componer-ensayar',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'ensayar',
    necesitaTonalidad: true,
    titulo: 'Ensayar',
    texto:
      'Tocas tu canción contra el metrónomo y te digo cómo ha ido, acorde a acorde. Sirve cuando ya hay algo escrito.',
    objetivo: '[data-tour="componer-ensayo"], section[aria-label="Ensayo"]',
    nombre: 'el ensayo',
  },
  {
    id: 'componer-areas',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'escribir',
    necesitaTonalidad: true,
    soloEnElBanco: true,
    titulo: 'Las áreas se pliegan',
    texto:
      'Cada pieza tiene su cabecera: la flecha la pliega a una tira y las otras dos la estrechan o la ensanchan. También se arrastra su borde, y cada espacio recuerda cómo lo dejas.',
    objetivo: 'section[aria-label="Acorde"] > header',
    nombre: 'la cabecera del área del acorde',
  },
  {
    id: 'componer-pestanas',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'escribir',
    necesitaTonalidad: true,
    soloSinBanco: true,
    titulo: 'Una pieza cada vez',
    texto:
      'Aquí no caben todas a la vez, así que van en pestañas: la canción, a dónde puede ir y el acorde que tienes elegido.',
    objetivo: '[data-tour="componer-pestanas"]',
    nombre: 'las pestañas de componer',
  },
  {
    id: 'componer-restablecer',
    seccion: 'Componer',
    ruta: '/componer',
    espacio: 'escribir',
    necesitaTonalidad: true,
    soloEnElBanco: true,
    titulo: 'Restablecer paneles',
    texto: 'Si lo dejas hecho un lío, esto devuelve las áreas a como venían en este espacio.',
    objetivo: '[data-tour="componer-restablecer"]',
    nombre: 'Restablecer paneles',
  },
  {
    id: 'componer-bandeja',
    seccion: 'Componer',
    ruta: '/componer',
    necesitaTonalidad: true,
    titulo: 'Lo que se abre abajo',
    texto:
      'El mástil con las formas de cada acorde, las salidas que te propone la IA, tus canciones guardadas y las sesiones de antes.',
    textoMovil:
      'En «Más» están el mástil con las formas de cada acorde, las salidas que te propone la IA, tus canciones guardadas y las sesiones de antes.',
    objetivo: '[data-tour="componer-bandeja"]',
    nombre: 'el mástil, las salidas, las canciones y las sesiones',
  },
  {
    id: 'componer-metronomo',
    seccion: 'Componer',
    ruta: '/componer',
    necesitaTonalidad: true,
    titulo: 'El metrónomo',
    texto:
      '«Metrónomo» enciende el pulso, y el número abre la velocidad y el compás. Es el mismo con el que se cuenta al tocar.',
    objetivo: '[data-tour="componer-metronomo"]',
    nombre: 'el metrónomo',
  },
  {
    id: 'componer-atajos',
    seccion: 'Componer',
    ruta: '/componer',
    necesitaTonalidad: true,
    soloEnElBanco: true,
    titulo: 'Con el teclado',
    texto:
      'Las teclas 1, 2 y 3 cambian de espacio; los corchetes pliegan los lados y la barra invertida lo devuelve todo. Cada botón dice la suya al pasar por encima.',
    objetivo: '[data-tour="componer-espacios"]',
    nombre: 'los espacios de trabajo, con sus teclas',
  },
  {
    id: 'afinar-afinacion',
    seccion: 'Afinar',
    ruta: '/afinar',
    titulo: 'Afinar: tu afinación',
    texto: 'Elige con qué afinación tocas antes de empezar. Se recuerda para la próxima vez.',
    objetivo: '[data-tour="afinar-afinacion"]',
    nombre: 'la afinación',
  },
  {
    id: 'afinar-afinador',
    seccion: 'Afinar',
    ruta: '/afinar',
    titulo: 'Cuerda a cuerda',
    texto:
      'Pulsa «Escuchar la guitarra» y toca una cuerda: te digo si está alta o baja hasta que quede en su sitio.',
    objetivo: '[data-tour="afinar-afinador"]',
    nombre: 'el afinador',
  },
  {
    id: 'despedida',
    seccion: 'Afinar',
    titulo: 'Ya está',
    texto:
      'Si quieres verlo otra vez, está en Aprender, debajo del botón de seguir. Ahora te devuelvo a donde estabas.',
  },
];

/** Los pasos que existen con este ancho: sin banco, ni áreas ni teclas. */
export function pasosPara(hayBanco: boolean): readonly Paso[] {
  return PASOS.filter((paso) =>
    hayBanco ? paso.soloSinBanco !== true : paso.soloEnElBanco !== true,
  );
}

/** El texto que toca con este ancho. */
export function textoDe(paso: Paso, hayBanco: boolean): string {
  return hayBanco ? paso.texto : (paso.textoMovil ?? paso.texto);
}

/**
 * Dónde se sigue cuando el paso guardado no existe con el ancho de ahora.
 *
 * Pasa al girar una tableta a mitad de recorrido: el paso de las áreas solo
 * existe con banco. Se sigue por el siguiente que sí exista, en el orden de
 * siempre, para no repetir ni saltarse nada.
 */
export function indiceDe(pasos: readonly Paso[], id: string | null): number {
  if (id === null) {
    return 0;
  }
  const exacto = pasos.findIndex((paso) => paso.id === id);
  if (exacto !== -1) {
    return exacto;
  }
  const enElOrden = PASOS.findIndex((paso) => paso.id === id);
  if (enElOrden === -1) {
    return 0;
  }
  const siguiente = PASOS.slice(enElOrden).find((paso) => pasos.includes(paso));
  /* v8 ignore next -- la despedida existe con cualquier ancho, así que siempre hay siguiente */
  return siguiente === undefined ? 0 : pasos.indexOf(siguiente);
}
