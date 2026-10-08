import { notFound } from 'next/navigation';

/**
 * Cualquier dirección que no casa con nada, **dentro del marco**.
 *
 * Sin esta página la contestaba el `not-found.tsx` de la raíz, que no pasa por
 * el layout de `(marco)` y tenía que montar su propio `AppShell` para no dejar a
 * nadie sin barra. Y un `not-found` de la raíz viaja con el layout raíz: la
 * barra, el micro y el menú de la cuenta entraban en el paquete de **todas** las
 * rutas, también en el de la portada, que no los usa. Con esta, una dirección
 * inventada se pinta con `(marco)/not-found.tsx`, dentro del marco que ya hay.
 */
export default function DireccionQueNoExiste(): never {
  notFound();
}
