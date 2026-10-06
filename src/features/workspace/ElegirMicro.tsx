'use client';

import { useEffect, useId, type MouseEvent } from 'react';

import { useClaqueta } from '@state/claqueta';
import { nombreDeLaEntrada, useMicrofono } from '@state/microfono';
import { useSessionStore } from '@state/session-store';
import { cambiarDeMicro, ponerAlDiaLasEntradas } from '@state/use-listening';
import { Chevron } from '@ui/Chevron';
import { cerrarAlSalirElFoco } from '@ui/cerrar-al-salir-el-foco';

/**
 * El mando para elegir micrófono, **en la barra y en todas las pantallas**.
 *
 * Solo el afinador dejaba elegirlo, y solo para él: componer, las unidades y la
 * toma abrían siempre el del sistema, que con una tarjeta de sonido enchufada es
 * el del portátil. La elección es una (`state/microfono.ts`) y este mando la
 * cambia desde cualquier sitio, también con el micro abierto: lo cambia en
 * caliente, o al acabar la toma si hay una (`cambiarDeMicro`).
 *
 * **El panel es un `popover` del navegador, no un `Disclosure` que flota**, y no
 * es por la fila que se desplaza del [adr/0065](../../../docs/adr/0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md):
 * la barra no se desplaza. Es por dos cosas que un `Disclosure` no puede hacer
 * aquí:
 *
 * - **Su panel mide lo que mide su rótulo**: se ancla de borde a borde de su
 *   `<details>`, y el rótulo es un botón redondo de 44 px. La lista de micros
 *   saldría de 44 px de ancho.
 * - **Taparía menos de lo que lo tapa a él.** La barra lleva `backdrop-blur`, que
 *   la hace contexto de apilamiento, y lo que va dentro no sale por encima de lo
 *   que flota en la pantalla: en componer sin tonalidad, la rueda se abre sola
 *   debajo de la barra y se quedaría encima de la lista. El `popover` va a la
 *   capa de arriba del documento y no compite con nadie.
 *
 * Sin velo, a diferencia de los tres de componer: es una lista que se abre de un
 * botón, como el menú de la cuenta que tiene al lado, y no un panel de ajustes.
 */
export function ElegirMicro() {
  const elegido = useMicrofono((estado) => estado.elegido);
  const entradas = useMicrofono((estado) => estado.entradas);
  const delSistema = useMicrofono((estado) => estado.delSistema);
  const conNombres = useMicrofono((estado) => estado.conNombres);
  const cayo = useMicrofono((estado) => estado.cayo);
  const pendiente = useMicrofono((estado) => estado.pendiente);
  const anuncio = useMicrofono((estado) => estado.anuncio);
  /*
    **Callado durante la toma** (adr/0072): el micro oiría al lector de pantalla,
    y lo que se toca es la canción. El cambio, además, espera a que acabe.
  */
  const enLaToma = useClaqueta((estado) => estado.enLaToma);
  const capturando = useSessionStore((estado) => estado.capturing);
  const panel = useId();

  // Lo guardado, después de pintar: leerlo en el render daría un HTML distinto en
  // el servidor. Y la lista, por si ya hay permiso de otra vez y trae los nombres.
  useEffect(() => {
    if (!useMicrofono.getState().cargado) {
      useMicrofono.getState().acciones.cargar();
    }
    void ponerAlDiaLasEntradas();
  }, []);

  const nombreElegido = useMicrofono((estado) => estado.nombreElegido);
  const nombre = nombreDeLaEntrada(elegido, { entradas, elegido, nombreElegido });
  /** El elegido, si ya se sabe que no está: con la lista entera y sin él. */
  const desconectado =
    elegido !== null && conNombres && !entradas.some((entrada) => entrada.id === elegido);

  function elegir(id: string | null, evento: MouseEvent<HTMLButtonElement>) {
    // Elegir cierra la lista, y el navegador devuelve el foco al botón que la abrió.
    const lista = evento.currentTarget.closest<HTMLElement>('[popover]');
    // La API falta en jsdom; los navegadores a los que va esto la traen desde 2024.
    if (typeof lista?.hidePopover === 'function') {
      lista.hidePopover();
    }
    void cambiarDeMicro(id);
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={panel}
        // **Empieza por lo que es, y sigue por cuál** (WCAG 2.5.3): «Micrófono»
        // es lo que se dice para pulsarlo, y el nombre es lo que se quiere saber.
        aria-label={`Micrófono: ${desconectado ? `${nombre}, no conectado` : nombre}`}
        title={cayo ? 'El micrófono elegido no está conectado' : `Micrófono: ${nombre}`}
        className="size-tap text-text-muted hover:bg-surface-raised hover:text-text relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
      >
        <Chevron className="size-3" />
        {/* El aviso de que se oye por otro, **a la vista y sin abrir nada**: quien
            desenchufó la tarjeta sin darse cuenta tiene que ver por qué suena
            distinto. El texto va en el nombre y en la lista. */}
        {(cayo || pendiente) && (
          <span
            aria-hidden="true"
            data-aviso-del-micro
            className={`absolute top-2 right-2 size-2 rounded-full ${
              cayo ? 'bg-oxblood-bright' : 'bg-brass-bright'
            }`}
          />
        )}
      </button>

      <div
        id={panel}
        popover="auto"
        aria-label="Elegir micrófono"
        // Si el tabulador se sale, se cierra (adr/0084).
        onBlur={cerrarAlSalirElFoco}
        // Al abrir se vuelve a preguntar: el permiso puede haber llegado ahora, y
        // con él los nombres.
        onToggle={(evento) => {
          if (evento.newState === 'open') {
            void ponerAlDiaLasEntradas();
          }
        }}
        // Pegado debajo de la barra y a la derecha, que es donde está su botón:
        // un `popover` no sabe anclarse a él sin `anchor-positioning`, que no
        // traen todos, y la barra mide siempre lo mismo.
        className="superficie-alta text-text fixed inset-auto top-16 right-[max(0.75rem,env(safe-area-inset-right))] m-0 max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto p-3"
      >
        <p className="rotulo mb-2">Micrófono</p>

        {cayo && (
          <p className="text-oxblood-bright mb-2 text-sm">
            El micrófono elegido no está conectado: escucho por el del sistema.
          </p>
        )}
        {pendiente && (
          // No interrumpir lo que se graba es la razón; decirla evita que parezca
          // que no ha hecho caso.
          <p className="text-brass-bright mb-2 text-sm">
            Cambiaré de micrófono al acabar la toma, para no cortar lo que se graba.
          </p>
        )}

        <ul className="flex flex-col gap-1">
          <li>
            <Opcion puesto={elegido === null} onClick={(evento) => elegir(null, evento)}>
              El del sistema
              {delSistema !== null && (
                <span className="text-text-muted block truncate text-xs">{delSistema}</span>
              )}
            </Opcion>
          </li>
          {entradas.map((entrada) => (
            <li key={entrada.id}>
              <Opcion
                puesto={elegido === entrada.id}
                onClick={(evento) => elegir(entrada.id, evento)}
              >
                {nombreDeLaEntrada(entrada.id, { entradas, elegido, nombreElegido })}
              </Opcion>
            </li>
          ))}
          {desconectado && (
            <li>
              <Opcion puesto onClick={(evento) => elegir(elegido, evento)}>
                {nombre}
                <span className="text-text-muted block text-xs">No está conectado</span>
              </Opcion>
            </li>
          )}
        </ul>

        {!conNombres && (
          <p className="text-text-muted mt-2 text-sm">
            Los nombres de los micrófonos salen al darle permiso: pulsa el micro de la barra.
          </p>
        )}
      </div>

      {/* La región viva nace vacía y antes de su frase, y se calla sin
          desmontarse (adr/0084). */}
      <span className="sr-only" aria-live={enLaToma || capturando ? 'off' : 'polite'}>
        {anuncio}
      </span>
    </>
  );
}

/**
 * Una entrada de la lista. **Puesta lleva su piloto**, como todo lo elegido en la
 * aplicación, y `aria-pressed` para quien no la ve.
 */
function Opcion({
  puesto,
  onClick,
  children,
}: {
  readonly puesto: boolean;
  readonly onClick: (evento: MouseEvent<HTMLButtonElement>) => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={puesto}
      onClick={onClick}
      // Más relleno abajo que arriba: el piloto se enciende a 5 px del borde, y con
      // el nombre del del sistema debajo, lo pisaba.
      className={`min-h-tap w-full cursor-pointer rounded-md px-3 pt-1.5 pb-3 text-left text-sm transition-colors ${
        puesto
          ? 'bg-surface text-brass-bright piloto'
          : 'text-text hover:bg-surface hover:text-brass-bright'
      }`}
    >
      {children}
    </button>
  );
}
