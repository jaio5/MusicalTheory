'use client';

import type { ReactNode } from 'react';

/**
 * Un formulario de esta aplicación: una columna estrecha que se envía.
 *
 * Los cinco de la cuenta lo escribían igual, y lo que se repetía no era el ancho
 * sino el `preventDefault`. Sin él el navegador recarga la página al enviar, se
 * pierde lo escrito y no llega a correr nada de lo que hay debajo; es el fallo
 * que no se ve al escribirlo y aparece la primera vez que alguien pulsa Intro en
 * vez del botón.
 *
 * El `void` es para que ESLint no se queje de una promesa que nadie espera: quien
 * envía ya lleva su propio `try/finally` con el «trabajando».
 */
export function Formulario({
  onEnviar,
  className = '',
  children,
}: {
  /** Lo que hace el envío. Puede ser asíncrono: no se espera. */
  readonly onEnviar: () => void | Promise<unknown>;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <form
      // **Sin la validación del navegador**, que la escribe en su idioma: encima
      // de un formulario en español salía «Please fill out this field». Esa
      // burbuja no se puede traducir ni colocar, así que aquí no sale ninguna y
      // lo que falta se dice con `ui/Aviso`, como se dice todo lo demás.
      //
      // No se pierde nada: los cinco formularios de la cuenta ya tienen su propia
      // condición para poder enviarse, y quien decide de verdad es el servidor.
      // `required` se queda en los campos —un lector de pantalla lo anuncia— y
      // deja de ser lo que aborta el envío.
      noValidate
      className={`flex max-w-sm flex-col gap-3 ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        void onEnviar();
      }}
    >
      {children}
    </form>
  );
}
