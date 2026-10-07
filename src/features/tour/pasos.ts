/**
 * Los pasos del recorrido de la primera visita, **por tramos**: uno de bienvenida y
 * uno por pantalla, que sale al llegar a ella.
 *
 * Es **dato y no componente** a propósito: lo que se dice en cada paso y qué
 * pieza se señala se lee de arriba abajo aquí, sin buscarlo entre efectos. Quien
 * cambie de sitio una pieza de la pantalla tiene que venir aquí, y el test de
 * los pasos le dice si se ha dejado alguno sin pieza que señalar.
 *
 * **Eran veintiún pasos seguidos, en un diálogo modal**, que navegaba solo de
 * pantalla en pantalla y tapaba la aplicación antes de que se hubiera visto
 * nada: «Bienvenida · 1 de 21». Ahora son cinco, repartidos donde hacen falta,
 * y ninguno bloquea
 * ([adr/0108](../../../docs/adr/0108-el-recorrido-sale-por-pantallas.md)).
 *
 * Las piezas se buscan por `data-tour`, que es un nombre estable puesto a mano en
 * cada una, y donde la pieza ya lleva un nombre que nadie va a cambiar —la
 * navegación— por ese nombre. **Nunca por su clase ni por su posición**: eso
 * cambia con cada retoque de la pantalla y el recorrido se quedaría señalando el aire.
 */

import type { Tramo } from './tramos';

export type { Tramo };

export interface Paso {
  /** Su nombre, que es lo que se guarda para seguir tras una recarga. */
  readonly id: string;
  readonly tramo: Tramo;
  readonly titulo: string;
  /** Dos frases como mucho, y sin jerga. */
  readonly texto: string;
  /**
   * Dónde está la pieza: selectores separados por comas, y vale **el primero
   * que se vea**. Así un mismo paso señala la lista de acordes cuando ya hay
   * tonalidad y los cuatro botones de salida cuando todavía no. Todos señalan
   * algo: una tarjeta suelta en medio, sin pieza, es la que tapa sin explicar.
   */
  readonly objetivo: string;
  /** Cómo se llama la pieza al anunciarla, para quien no la ve. */
  readonly nombre: string;
  /**
   * Si la pieza tiene algo que flota fuera de su caja —el panel de la rueda— y
   * hay que señalarlo también.
   */
  readonly conLoQueFlota?: boolean;
}

export const PASOS: readonly Paso[] = [
  {
    id: 'bienvenida',
    tramo: 'bienvenida',
    titulo: 'Bienvenido a Caos ordenado',
    texto:
      'Aprendes armonía en unidades cortas, escribes tus canciones con ayuda y afinas la guitarra. Te cuento lo justo de cada pantalla al llegar a ella; si lo saltas, lo retomas desde Aprender.',
    objetivo: 'nav[aria-label="Pantallas"], nav[aria-label="Pantallas, abajo"]',
    nombre: 'la navegación entre pantallas',
  },
  {
    id: 'aprender-hoy',
    tramo: 'aprender',
    titulo: 'Por dónde seguir',
    texto:
      'El botón grande te lleva a la siguiente unidad, y la primera empieza por las notas. Si ya sabes teoría, con «Empiezo por» saltas al curso que quieras.',
    objetivo: '[data-tour="aprender-hoy"]',
    nombre: 'la meta de hoy y el botón de seguir',
  },
  {
    id: 'componer-empezar',
    tramo: 'componer',
    titulo: 'Tu canción, acorde a acorde',
    texto:
      'Elige tonalidad —si no sabes cuál, C mayor— y pulsa acordes de «Para empezar»: entran en la canción y suenan. Los de arriba son los que mejor siguen a lo que llevas.',
    // La lista cuando ya hay tonalidad; sin ella, en un teléfono la barra que
    // flota con las cuatro de salida, y en el banco el estado vacío que las trae.
    objetivo:
      '[data-tour="componer-que-poner"], [data-tour="componer-tonalidad"], [data-tour="componer-empezar"]',
    nombre: 'por dónde empezar la canción',
    conLoQueFlota: true,
  },
  {
    id: 'componer-espacios',
    tramo: 'componer',
    titulo: 'Tres maneras de escribirla',
    texto:
      'Escribir es por donde se empieza; Tocando apunta lo que suena por el micro, que ayuda pero duda con los acordes. Ensayar te la hace tocar contra el metrónomo y te dice cómo ha ido.',
    objetivo: '[data-tour="componer-espacios"]',
    nombre: 'los tres espacios de trabajo',
  },
  {
    id: 'afinar-afinador',
    tramo: 'afinar',
    titulo: 'Afinar, cuerda a cuerda',
    texto:
      'Elige tu afinación, pulsa «Escuchar la guitarra» y toca una cuerda al aire. Te digo si está alta o baja hasta que quede en su sitio.',
    objetivo: '[data-tour="afinar-afinador"]',
    nombre: 'el afinador',
  },
];

/** Los pasos de un tramo, en su orden. */
export function pasosDe(tramo: Tramo): readonly Paso[] {
  return PASOS.filter((paso) => paso.tramo === tramo);
}

/** Por dónde se sigue dentro del tramo: el paso guardado, o el primero. */
export function indiceDe(pasos: readonly Paso[], id: string | null): number {
  const guardado = pasos.findIndex((paso) => paso.id === id);
  return guardado === -1 ? 0 : guardado;
}
