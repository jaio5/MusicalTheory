/**
 * El punto de tres estados de esta aplicación: **con forma, no solo con color**.
 *
 * Aquí hay dos códigos de tres colores —verde, ámbar y rojo— que dicen si un
 * acorde entra en la tonalidad y qué papel armónico tiene. Verde contra rojo es
 * justo la pareja que no distingue la deficiencia de color más común, y le pasa a
 * uno de cada doce hombres.
 *
 * Las aplicaciones que se apoyan en el color para esto lo resuelven enviando
 * paletas alternativas: Hooktheory manda cinco —dos de ellas para daltonismo— y
 * Yousician tiene un interruptor en ajustes. Aquí se resuelve por otro lado y sale
 * más barato: **la forma dice lo mismo que el color**, sin ajustes que configurar
 * y sin una paleta más que mantener en dos temas.
 *
 * Es la misma regla que este proyecto ya tenía escrita para el texto —«el
 * significado de un color al lado del color»— aplicada al propio punto.
 *
 * - `entra` es un círculo lleno: sólido, sin nada raro.
 * - `color` es un anillo: lo mismo con un hueco dentro.
 * - `fuera` es un rombo: la única que no es redonda, y se ve de reojo.
 */
export type MarcaTono = 'entra' | 'color' | 'fuera';

const FONDOS: Readonly<Record<MarcaTono, string>> = {
  entra: 'bg-tube-bright',
  color: 'bg-brass-bright',
  fuera: 'bg-oxblood-bright',
};

const APAGADOS: Readonly<Record<MarcaTono, string>> = {
  entra: 'bg-tube',
  color: 'bg-brass',
  fuera: 'bg-oxblood',
};

export function Marca({
  tono,
  apagada = false,
  senal = false,
  className = '',
}: {
  readonly tono: MarcaTono;
  /** El tono de relleno en vez del de escribir, para filos y adornos. */
  readonly apagada?: boolean;
  /**
   * Que sobreviva al velo de grabar.
   *
   * Mientras se graba, `globals.css` deja transparente todo lo que no lleve
   * `data-senal`: la marca es de las pocas cosas que tienen que seguir viéndose,
   * porque es lo único que da tiempo a mirar tocando.
   */
  readonly senal?: boolean;
  readonly className?: string;
}) {
  const fondo = apagada ? APAGADOS[tono] : FONDOS[tono];
  const marca = senal ? { 'data-senal': '' } : {};

  if (tono === 'color') {
    // Un anillo: el borde lleva el color y el centro se queda hueco. Con
    // `border` y no con un punto encima, para que funcione sobre cualquier fondo.
    return (
      <span
        aria-hidden="true"
        {...marca}
        className={`block size-2 shrink-0 rounded-full border-2 ${fondo.replace('bg-', 'border-')} ${className}`}
      />
    );
  }

  if (tono === 'fuera') {
    // El rombo es un cuadrado girado. Se hace un poco más pequeño porque al
    // girarlo su diagonal crece, y sin eso pesa más que los otros dos.
    return (
      <span
        aria-hidden="true"
        {...marca}
        className={`block size-1.5 shrink-0 rotate-45 ${fondo} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      {...marca}
      className={`block size-2 shrink-0 rounded-full ${fondo} ${className}`}
    />
  );
}
