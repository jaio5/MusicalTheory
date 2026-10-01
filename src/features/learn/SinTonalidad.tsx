import { CuatroTonalidades } from '@ui/EmpezarPorTonalidad';
import { IconoTonalidad } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

/**
 * Lo que enseña una unidad cuando todavía no hay tonalidad.
 *
 * Eran los cuatro botones **pegados al borde de abajo**, con trescientos treinta
 * píxeles vacíos encima. Se bajaron allí cuando la barra de tonalidad empujaba y
 * lo de arriba quedaba tapado; hoy flota y, mientras está abierta, esta caja no
 * se ve ni recibe el foco (`UnitScreen`, con `inert`). Así que esto solo se ve
 * **con la rueda cerrada**, y entonces lo que toca es un estado vacío de verdad:
 * centrado, diciendo qué falta y con la acción al lado de lo que la pide.
 *
 * `my-auto` y no `justify-center`: en una ventana baja, centrar la caja que se
 * desplaza saca por arriba lo que no cabe y el desplazamiento no llega.
 */
export function SinTonalidad({ para }: { readonly para: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="my-auto">
        <Vacio
          icono={<IconoTonalidad />}
          titulo="Falta la tonalidad"
          accion={<CuatroTonalidades />}
        >
          {para} O ábrela arriba y elige cualquiera de la rueda.
        </Vacio>
      </div>
    </div>
  );
}
