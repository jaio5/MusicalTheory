/**
 * La flecha de los dos desplegables.
 *
 * Una sola geometría: la del selector estaba metida en un `data:` URI con el gris
 * escrito a mano —`%23a79c8c`, que es el token `textMuted` transcrito fuera del
 * sistema— y la del bloque que se abre, dibujada aparte en JSX. Eran «la misma
 * flecha» por coincidencia, y cambiar el color de los rótulos dejaba una de las
 * dos con el gris viejo sin que fallara nada.
 *
 * Hereda `currentColor`, así que el color lo pone quien la usa.
 */
export function Chevron({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 12 8"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 1.75 6 6.25l4.5-4.5" />
    </svg>
  );
}
