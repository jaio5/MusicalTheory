'use client';

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
export function EmpezarPorTonalidad({ deps }: { readonly deps?: ListeningDeps } = {}) {
  const actions = useSessionStore((state) => state.actions);
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
          <div className="flex flex-wrap justify-center gap-2">
            {DE_SALIDA.map(({ nota, modo }) => {
              const tonic = pitchClassFromName(nota);
              return (
                <Button
                  key={`${nota}-${modo}`}
                  variant="quiet"
                  className="px-4 text-sm"
                  onClick={() => actions.pinKey({ tonic, mode: modo })}
                >
                  {keyName(tonic, modo)}
                </Button>
              );
            })}
          </div>

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
                className="px-3 text-xs"
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
