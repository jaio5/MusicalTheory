'use client';

import type { ReactNode } from 'react';

import { keyName, pitchClassFromName, type KeyMode, type NoteName } from '@core/music';
import { useSessionStore } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';
import { Button } from './Button';
import { IconoComponer, IconoMicro } from './icons';
import { Vacio } from './Vacio';

/**
 * Las cuatro tonalidades con las que empieza casi todo el mundo.
 *
 * No es una lista de favoritos: son las que salen sin sostenidos ni bemoles o
 * con uno solo, que en guitarra es donde caen los acordes al aire. Cuatro y no
 * doce, porque la rueda entera ya está al lado; esto es el atajo para quien
 * todavía no sabe cuál elegir, y una lista de doce atajos no es un atajo.
 */
const DE_SALIDA: ReadonlyArray<{ nota: NoteName; modo: KeyMode }> = [
  { nota: 'C', modo: 'major' },
  { nota: 'G', modo: 'major' },
  { nota: 'A', modo: 'minor' },
  { nota: 'E', modo: 'minor' },
];

/**
 * Lo que se ve en componer antes de elegir tonalidad.
 *
 * Era una frase gris flotando en medio de setecientos píxeles de negro: «Elige
 * una tonalidad en la rueda y empezamos». Decía qué hacer y no ofrecía dónde, y
 * la rueda de al lado tampoco parecía elegible —doce letras tumbadas sobre un
 * disco—. Quien entra por primera vez a la pantalla principal de la aplicación se
 * encontraba con eso.
 *
 * Ahora explica el orden y **trae la primera decisión hecha a medias**: cuatro
 * tonalidades de salida a un toque. La rueda sigue estando para quien sepa cuál
 * quiere; esto es para quien no.
 *
 * Vive en `ui/` y no dentro de la rueda porque lo usan dos sitios que no se
 * conocen —componer y el lienzo de montar— y un feature no importa de otro. Es
 * la misma razón por la que la mascota vive aquí.
 */
/**
 * Las cuatro de salida, en una línea.
 *
 * Es la versión que cabe **debajo de la barra de tonalidad cuando se abre sola**.
 * Esa barra flota sobre lo que hay debajo y, sin tonalidad puesta, se abre ella
 * misma: el sitio que queda puede ser una tira de noventa píxeles, y ahí un
 * estado vacío entero —icono, título y tres líneas— sale partido por el borde
 * del panel, que se lee como que algo se ha roto.
 *
 * Y lo que decía ese estado era «está en la rueda de aquí arriba», debajo de la
 * rueda que lo estaba tapando: señalar en vez de ofrecer, que es justo el fallo
 * que cuenta el comentario de arriba. Cuatro botones caben siempre y resuelven
 * el paso sin tocar la rueda.
 */
export function CuatroTonalidades({ children }: { readonly children?: ReactNode }) {
  return (
    // La frase encima y los cuatro debajo, **en una fila o en dos por dos**.
    //
    // Iban todos en la misma línea que se partía donde tocara: 3 + 1 en un
    // escritorio y 1 + 3 en un teléfono, con «E menor» sola en su fila como si
    // sobrara. Cuatro opciones del mismo peso se leen como un juego cuando
    // comparten fila o forman un cuadrado, y como un error cuando una se queda
    // colgando. En una rejilla la partición la decide el ancho de verdad, y el
    // alto sale menor que con la frase metida en la fila: medía dos filas de
    // botones y ahora una fila de texto y una de botones.
    //
    // Sin relleno a los lados: vive dentro de un panel o de un estado vacío que
    // ya ponen el suyo, y con los dos no cabían los cuatro en fila a 390.
    //
    // `w-full` porque la rejilla mide su caja: en la barra flotante esto va en
    // una columna centrada, se encogía a lo que ocupaba la frase y dejaba los
    // cuatro en 123 px, dos por fila y «C mayor» saliéndose del botón.
    <div className="flex w-full flex-col items-center gap-2 py-3">
      {children !== undefined && (
        <span className="text-text-muted text-center text-sm">{children}</span>
      )}
      <FilaDeSalida />
    </div>
  );
}

/**
 * Los cuatro botones en su rejilla, compartidos por las dos versiones.
 *
 * Con nombre, porque al lado hay veinticuatro botones más que dicen casi lo
 * mismo: los de la rueda. Sin él, «C mayor» aquí y «C mayor» allí son la misma
 * cosa para quien no ve cuál está dentro de un disco.
 *
 * Dos por dos hasta que caben los cuatro y en fila a partir de ahí, **medido
 * sobre la caja y no sobre la ventana**. En fila cada uno pide unos setenta
 * píxeles con su letra y su relleno, así que el corte está en 19 rem (304 px)
 * de caja. Se contaba con la ventana, y junto a la rueda la caja mide 250 px en
 * cualquier escritorio: a partir de 640 los cuatro se metían en fila en ese hueco
 * y los nombres se montaban unos sobre otros.
 *
 * El contenedor lleva `w-full` porque uno de tamaño en línea no toma el ancho de
 * lo que tiene dentro: sin él, en una columna centrada se quedaba en cero. Y
 * `max-w-sm` para que en un estado vacío ancho los cuatro no se estiren a lo
 * ancho de la pantalla: son cuatro botones, no una barra.
 */
function FilaDeSalida() {
  const actions = useSessionStore((state) => state.actions);

  return (
    <div className="@container w-full max-w-sm">
      <div
        role="group"
        aria-label="Tonalidades para empezar"
        className="grid grid-cols-2 gap-2 @min-[19rem]:grid-cols-4"
      >
        {DE_SALIDA.map(({ nota, modo }) => {
          const tonic = pitchClassFromName(nota);
          return (
            <Button
              key={`${nota}-${modo}`}
              variant="quiet"
              className="px-3 text-sm whitespace-nowrap"
              onClick={() => actions.pinKey({ tonic, mode: modo })}
            >
              {keyName(tonic, modo)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function EmpezarPorTonalidad({ deps }: { readonly deps?: ListeningDeps } = {}) {
  const listening = useSessionStore((state) => state.listening);
  // Reconocer acordes además de notas: es lo que hace falta en componer, que es
  // donde vive esto.
  const { start } = useListening({ chords: true, ...deps });

  const escuchando = listening === 'listening';

  return (
    <Vacio
      icono={<IconoComponer />}
      titulo="Empieza eligiendo la tonalidad"
      accion={
        <div className="flex flex-col items-center gap-3">
          <FilaDeSalida />

          {/*
            Y la tercera salida, **ofrecida y no solo mencionada**.

            El texto decía «o toca unos compases con el micro abierto y la
            detectamos sola» y no había forma de abrir el micro desde aquí: el
            botón estaba arriba en la barra, sin nada que lo relacionara con esta
            frase. Es la promesa de la portada —que te oye tocar— contada en el
            sitio donde pasa y sin manera de aceptarla.

            Mientras ya se está escuchando no se ofrece: entonces lo que toca es
            tocar, y el botón no tendría nada que hacer.

            **Notas sueltas y no «unos compases»**, que es lo que decía. La
            tonalidad se deduce del histograma de alturas, y ese lo llena el motor
            de tono, que es monofónico: rasgueando acordes no entra ni una nota y
            no se detecta nada. Comprobado tocándole a la aplicación un WAV de
            acordes —doce segundos, cero detección— y otro de una escala, que la
            saca en cuatro. Prometer que basta con tocar es prometer algo que solo
            pasa a veces.
          */}
          {!escuchando && (
            <span className="text-text-muted flex flex-wrap items-center justify-center gap-2 text-xs">
              o toca unas notas sueltas y la detecto sola:
              <Button
                variant="quiet"
                onClick={() => void start()}
                disabled={listening === 'requesting'}
                tamano="compacto"
              >
                <IconoMicro />
                {listening === 'requesting' ? 'Pidiendo permiso…' : 'Abrir el micrófono'}
              </Button>
            </span>
          )}
        </div>
      }
    >
      Todo lo demás sale de ahí: los acordes que caben, a dónde puede seguir cada uno y las
      preguntas del profesor. Púlsala en la rueda o empieza por una de estas.
    </Vacio>
  );
}
