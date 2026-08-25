import type { ReactElement } from 'react';

/**
 * Los iconos de la navegación, dibujados y no escritos.
 *
 * Eran emoji —🗺️ 💬 🎛️ 🎚️— y por tres razones no podían quedarse. Se dibujan
 * distinto en cada sistema, así que la aplicación no se ve igual en el móvil que
 * en el portátil de al lado. **No se dejan teñir**: la pantalla en la que estás se
 * marca en latón, y el emoji seguía con sus colores, así que el estado se perdía
 * justo en el sitio donde se mira para saber dónde estás. Y no escalan con la
 * tipografía, porque el sistema los dibuja al tamaño que quiere.
 *
 * Estos son trazos sobre `currentColor`, así que heredan el color del enlace y
 * el estado activo se ve sin leer nada. Uno por pantalla y ninguno más: un juego
 * de iconos crece hasta que nadie distingue dos de ellos.
 *
 * Van con `aria-hidden` siempre: el nombre de la pantalla está al lado en texto,
 * y un lector de pantalla que lea las dos cosas dice todo dos veces.
 */
function Trazo({ children }: { readonly children: ReactElement }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Aprender: el camino, que es la metáfora de la pantalla. */
export function IconoCamino() {
  return (
    <Trazo>
      <g>
        <path d="M7 20c0-4 3-4 3-8s-3-4-3-8" />
        <circle cx="7" cy="4" r="1.6" />
        <circle cx="10" cy="12" r="1.6" />
        <circle cx="7" cy="20" r="1.6" />
        <path d="M14 6h6M14 12h6M14 18h6" opacity="0.45" />
      </g>
    </Trazo>
  );
}

/** Profesor: una conversación, no un birrete. Lo que se hace es preguntar. */
export function IconoProfesor() {
  return (
    <Trazo>
      <g>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4z" />
        <path d="M9 9h6M9 12h4" opacity="0.55" />
      </g>
    </Trazo>
  );
}

/** Componer: los deslizadores de una mesa de mezclas. */
export function IconoComponer() {
  return (
    <Trazo>
      <g>
        <path d="M6 4v6M6 14v6M12 4v3M12 11v9M18 4v9M18 17v3" />
        <path d="M4 12h4M10 9h4M16 15h4" />
      </g>
    </Trazo>
  );
}

/** Afinar: la aguja del afinador, que es lo que se mira al afinar. */
export function IconoAfinar() {
  return (
    <Trazo>
      <g>
        <path d="M3.5 17a9 9 0 0 1 17 0" />
        <path d="M12 17l4-5.5" />
        <circle cx="12" cy="17" r="1.4" />
      </g>
    </Trazo>
  );
}

/**
 * Las dos clases de unidad: una se lee y la otra se toca.
 *
 * Eran 📖 y 🎸, y estaban en dos sitios con el mismo significado. Aquí se
 * distinguen por la forma —una hoja abierta y un mástil con clavijas— y se tiñen
 * con el estado de la unidad, que es lo que el emoji no hacía: en el camino, una
 * unidad cerrada se atenúa entera y el emoji se quedaba a todo color.
 */
export function IconoTeoria() {
  return (
    <Trazo>
      <g>
        <path d="M4 5.5h5.5A2.5 2.5 0 0 1 12 8v11a2 2 0 0 0-2-2H4z" />
        <path d="M20 5.5h-5.5A2.5 2.5 0 0 0 12 8v11a2 2 0 0 1 2-2h6z" />
      </g>
    </Trazo>
  );
}

export function IconoTocar() {
  return (
    <Trazo>
      <g>
        <path d="M9 3h6v3.5H9z" />
        <path d="M10 6.5v14M14 6.5v14" />
        <path d="M7 10h10M7 14h10M7 18h10" opacity="0.5" />
      </g>
    </Trazo>
  );
}

/**
 * Los cuatro estados que se leen de un vistazo en el camino.
 *
 * Eran 🔥 🩹 🔑 🔒. Los dos candados son el caso que más importa: el CLAUDE.md ya
 * decía que no pueden verse iguales, porque uno se abre estudiando y el otro
 * pagando, y con emoji ni se distinguían bien ni se teñían del color del estado.
 */
export function IconoRacha() {
  return (
    <Trazo>
      <path d="M12 3c3 3.5 4.5 5.8 4.5 8.3a4.5 4.5 0 0 1-9 0c0-1 .3-1.9.9-2.8.5 1 1.2 1.6 2.1 1.9-.3-2.4.2-4.6 1.5-7.4z" />
    </Trazo>
  );
}

/** Agrietada: superada, pero con preguntas esperando repaso. */
export function IconoGrieta() {
  return (
    <Trazo>
      <path d="M13 3 7.5 12H12l-1.5 9L17 11h-4.5z" />
    </Trazo>
  );
}

/** Cerrada por plan: se abre pagando, y una llave es lo que se compra. */
export function IconoLlave() {
  return (
    <Trazo>
      <g>
        <circle cx="8" cy="12" r="3.5" />
        <path d="M11.5 12H21M18 12v3M15 12v2.5" />
      </g>
    </Trazo>
  );
}

/** Cerrada por temario: se abre estudiando, y eso es un candado y no una llave. */
export function IconoCandado() {
  return (
    <Trazo>
      <g>
        <rect x="4.5" y="10.5" width="15" height="9.5" rx="1.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </g>
    </Trazo>
  );
}

/**
 * El sol y la luna del conmutador de tema.
 *
 * Se enseña **el tema al que se va**, no el que hay puesto: un icono de sol
 * mientras estás en claro no dice nada, y con el de luna se entiende sin leer que
 * pulsando se apaga la luz.
 */
export function IconoSol() {
  return (
    <Trazo>
      <g>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </g>
    </Trazo>
  );
}

export function IconoLuna() {
  return (
    <Trazo>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" />
    </Trazo>
  );
}
