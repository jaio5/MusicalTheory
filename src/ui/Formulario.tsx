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
