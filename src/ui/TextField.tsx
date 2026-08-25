import type { InputHTMLAttributes, ReactNode } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * El rótulo. Texto y no marcado, porque también es lo que lee el lector de
   * pantalla cuando va oculto.
   */
  readonly label: string;
  /**
   * Lo que va al lado del rótulo y no es parte del nombre del campo: «· mínimo
   * 8 caracteres», una marca de obligatorio. Aparte de `label` para que el
   * lector de pantalla anuncie «Contraseña» y no «Contraseña · mínimo 8».
   */
  readonly extra?: ReactNode;
  /** Oculta la etiqueta a la vista pero la deja para el lector de pantalla. */
  readonly compact?: boolean;
  /** Debajo del campo, en pequeño: qué se espera o qué ha salido mal. */
  readonly hint?: ReactNode;
  /**
   * `completo` ocupa la línea entera; `crece` se estira dentro de una fila y
   * deja sitio a lo que tenga al lado.
   *
   * Se pide y no se hereda, por lo mismo que en `ui/Field`: en la barra de
   * guardar una canción, un campo que ocupa la línea entera empuja el botón a la
   * de abajo.
   */
  readonly ancho?: AnchoTexto;
}

const ANCHOS_TEXTO = {
  completo: 'w-full',
  crece: 'min-w-0 flex-1 basis-48',
} as const;

export type AnchoTexto = keyof typeof ANCHOS_TEXTO;

/**
 * Un campo de escribir, con su etiqueta.
 *
 * Es el tercer componente de la misma familia que `ui/Field` —elegir una opción—
 * y `ui/Disclosure` —abrir un bloque—, y nace del mismo problema: estaba escrito
 * a mano **catorce veces** entre los formularios de la cuenta y el de canciones,
 * y ya había divergido en dos variantes según llevara o no `placeholder`.
 *
 * Lo que la duplicación escondía era peor que la duplicación: **ninguna de las
 * catorce copias llegaba a los 44 px** que esta aplicación exige en todo lo que
 * se pulsa. `py-2` con letra base se queda en unos 42, y nadie lo vio porque no
 * había un sitio donde mirarlo. Aquí el alto es `min-h-tap`, el mismo que los
 * botones y los desplegables.
 *
 * Un `<label>` que envuelve al `<input>` y no un `htmlFor` con identificador: no
 * hace falta inventarse identificadores únicos, y pulsar la etiqueta enfoca el
 * campo igual.
 */
export function TextField({
  label,
  extra,
  compact = false,
  hint,
  ancho = 'completo',
  className = '',
  ...props
}: TextFieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${ANCHOS_TEXTO[ancho]}`}>
      <span className={compact ? 'sr-only' : 'text-text-muted text-xs'}>
        {label}
        {!compact && extra}
      </span>
      <input
        aria-label={compact ? label : undefined}
        className={`border-border bg-background text-text placeholder:text-text-muted min-h-tap rounded-md border px-2 py-2 text-base ${className}`}
        {...props}
      />
      {hint !== undefined && <span className="text-text-muted text-xs">{hint}</span>}
    </label>
  );
}
