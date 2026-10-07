/*
 * GENERADO por arte/mascota/build.py. No se edita a mano: se cambia el script y
 * se vuelve a ejecutar (`python3 arte/mascota/build.py`).
 *
 * Cada capa es una lista de trazos, uno por color, hechos de rectángulos de un
 * píxel de alto sobre una rejilla de 32×32. El color es el nombre de una
 * variable `--mascota-*` de globals.css, no un valor: así cambia con el tema.
 */

/** Los colores del muñeco; cada uno es `var(--mascota-<nombre>)`. */
export const COLORES_MASCOTA = [
  'contorno',
  'cristal',
  'cristal-encendido',
  'cristal-luz',
  'cristal-sombra',
  'filamento',
  'halo',
  'laton',
  'laton-contorno',
  'laton-luz',
  'laton-sombra',
  'mejilla',
  'metal',
  'tinta',
  'verde',
  'verde-vivo',
] as const;

export type ColorMascota = (typeof COLORES_MASCOTA)[number];

export interface Trazo {
  readonly color: ColorMascota;
  readonly d: string;
}

/** El lado de la rejilla, en píxeles: el `viewBox` es 0 0 32 32. */
export const LADO_MASCOTA = 32;

export const CAPAS_MASCOTA = {
  vidrio: [
    {
      color: 'cristal',
      d: 'M14 2h4v1h-4zM11 3h10v1h-10zM10 4h13v1h-13zM9 5h14v1h-14zM9 6h13v9h-13zM8 15h14v6h-14z',
    },
  ],
  cuerpo: [
    {
      color: 'contorno',
      d: 'M15 0h2v1h-2zM14 1h1v1h-1zM17 1h1v1h-1zM11 2h3v1h-3zM18 2h3v1h-3zM9 3h2v1h-2zM21 3h2v1h-2zM8 4h1v1h-1zM23 4h1v1h-1zM7 5h1v17h-1zM24 5h1v17h-1zM9 30h2v1h-2zM21 30h2v1h-2zM15 31h2v1h-2z',
    },
    { color: 'cristal-luz', d: 'M15 1h2v1h-2zM9 4h1v1h-1zM8 5h1v10h-1z' },
    {
      color: 'cristal-sombra',
      d: 'M23 5h1v1h-1zM22 6h2v7h-2zM23 13h1v1h-1zM22 14h2v7h-2zM8 21h16v1h-16zM9 28h1v2h-1zM15 28h1v3h-1zM21 28h1v2h-1z',
    },
    { color: 'laton', d: 'M7 24h17v1h-17zM7 26h17v1h-17z' },
    { color: 'laton-contorno', d: 'M6 22h20v1h-20zM5 23h1v4h-1zM26 23h1v4h-1zM6 27h20v1h-20z' },
    { color: 'laton-luz', d: 'M6 23h20v1h-20z' },
    {
      color: 'laton-sombra',
      d: 'M6 24h1v1h-1zM24 24h2v1h-2zM6 25h20v1h-20zM6 26h1v1h-1zM24 26h2v1h-2z',
    },
    { color: 'mejilla', d: 'M9 13h2v1h-2zM21 13h2v1h-2z' },
    { color: 'metal', d: 'M10 28h1v2h-1zM16 28h1v3h-1zM22 28h1v2h-1z' },
  ],
  halo: [
    {
      color: 'verde-vivo',
      d: 'M11 17h10v1h-10zM10 18h2v1h-2zM13 18h3v1h-3zM17 18h3v1h-3zM21 18h1v1h-1zM9 19h2v1h-2zM12 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM18 19h1v1h-1zM20 19h1v1h-1zM9 20h1v2h-1zM11 20h3v1h-3zM15 20h3v1h-3zM19 20h2v1h-2zM11 21h10v1h-10z',
    },
  ],
  haloLejos: [
    { color: 'halo', d: 'M13 15h6v1h-6zM11 16h10v1h-10zM10 17h1v1h-1zM21 17h1v1h-1zM9 18h1v1h-1z' },
  ],
  filamentoApagado: [
    {
      color: 'filamento',
      d: 'M12 18h1v1h-1zM16 18h1v1h-1zM20 18h1v1h-1zM11 19h1v1h-1zM13 19h1v1h-1zM15 19h1v1h-1zM17 19h1v1h-1zM19 19h1v1h-1zM21 19h1v3h-1zM10 20h1v2h-1zM14 20h1v1h-1zM18 20h1v1h-1z',
    },
  ],
  filamentoEncendido: [
    {
      color: 'cristal-luz',
      d: 'M12 18h1v1h-1zM16 18h1v1h-1zM20 18h1v1h-1zM11 19h1v1h-1zM13 19h1v1h-1zM15 19h1v1h-1zM17 19h1v1h-1zM19 19h1v1h-1zM21 19h1v1h-1zM10 20h1v1h-1zM14 20h1v1h-1zM18 20h1v1h-1z',
    },
    { color: 'verde', d: 'M21 20h1v2h-1zM10 21h1v1h-1z' },
  ],
  cejas: [
    {
      color: 'tinta',
      d: 'M10 6h2v1h-2zM20 6h2v1h-2zM9 7h1v1h-1zM12 7h1v1h-1zM19 7h1v1h-1zM22 7h1v1h-1z',
    },
  ],
  cejasArriba: [
    {
      color: 'tinta',
      d: 'M10 5h2v1h-2zM20 5h2v1h-2zM9 6h1v1h-1zM12 6h1v1h-1zM19 6h1v1h-1zM22 6h1v1h-1z',
    },
  ],
  ojosAbiertos: [
    { color: 'cristal-luz', d: 'M10 9h1v1h-1zM19 9h1v1h-1z' },
    { color: 'tinta', d: 'M11 9h2v1h-2zM20 9h2v1h-2zM10 10h3v3h-3zM19 10h3v3h-3z' },
  ],
  ojosCerrados: [{ color: 'tinta', d: 'M10 11h3v1h-3zM19 11h3v1h-3z' }],
  bocaCallada: [{ color: 'laton-sombra', d: 'M13 15h1v1h-1zM18 15h1v1h-1zM14 16h4v1h-4z' }],
  bocaAbierta: [
    { color: 'laton-sombra', d: 'M14 14h4v1h-4zM13 15h1v2h-1zM18 15h1v2h-1zM14 17h4v1h-4z' },
    { color: 'mejilla', d: 'M15 16h2v1h-2z' },
    { color: 'tinta', d: 'M14 15h4v1h-4zM14 16h1v1h-1zM17 16h1v1h-1z' },
  ],
  bocaMedia: [
    { color: 'laton-sombra', d: 'M14 15h4v1h-4zM13 16h1v1h-1zM18 16h1v1h-1zM14 17h4v1h-4z' },
    { color: 'tinta', d: 'M14 16h4v1h-4z' },
  ],
} as const satisfies Record<string, readonly Trazo[]>;
