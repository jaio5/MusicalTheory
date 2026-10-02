"""
Los iconos de la aplicación, sacados del mismo dibujo que el profesor.

    ~/.local/share/pixel-art-studio/venv/bin/python arte/mascota/iconos.py

Escribe tres ficheros en `src/app/`, que Next convierte solo en sus etiquetas del
`<head>` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`):

- `icon.svg`, la pestaña de cualquier navegador de hoy. Es el profesor callado en
  rectángulos, con `crispEdges`, así que sale nítido a 16, a 32 o a 64 píxeles sin
  guardar un tamaño de cada. El contorno cambia con el tema del sistema: el grafito
  del tema claro desaparece sobre una barra de pestañas oscura, igual que pasaba
  en la aplicación (por eso el oscuro tiene el suyo en `PALETA`).
- `favicon.ico`, para lo que no lee SVG. Lleva el dibujo a 32 y a 64, los dos a
  escala entera: a 16 o a 48 el píxel caería entre dos y saldría borroso.
- `apple-icon.png`, la pantalla de inicio del móvil: 180 px, sobre la noche de la
  sala, porque iOS rellena de negro lo transparente y le pone sus esquinas.

No se edita ninguno a mano. Si cambia el profesor, se vuelve a ejecutar esto.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from build import ESTADOS, LADO, PALETA, RAIZ, capas, estado, trazos

APP = RAIZ / 'src/app'
ESTADO = 'callado'
# La noche de la sala (`--noche`, adr/0070): el fondo del icono de inicio.
NOCHE = '#0A0E19'


def pixeles() -> dict[tuple[int, int], str]:
    return estado(capas(), ESTADOS[ESTADO])


def svg(dibujo: dict[tuple[int, int], str]) -> str:
    """El profesor en rectángulos, con el contorno de cada tema del sistema."""
    caminos = []
    for color, d in trazos(dibujo):
        if color == 'contorno':
            caminos.append(f'<path class="contorno" d="{d}"/>')
        else:
            caminos.append(f'<path fill="{PALETA["claro"][color]}" d="{d}"/>')
    estilo = (
        f'.contorno{{fill:{PALETA["claro"]["contorno"]}}}'
        f'@media (prefers-color-scheme:dark){{.contorno{{fill:{PALETA["oscuro"]["contorno"]}}}}}'
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LADO} {LADO}" '
        f'shape-rendering="crispEdges"><style>{estilo}</style>{"".join(caminos)}</svg>\n'
    )


def imagen(dibujo: dict[tuple[int, int], str], escala: int, fondo: str | None = None) -> Image.Image:
    """El dibujo a una escala entera, con el contorno del tema claro."""
    lienzo = Image.new('RGBA', (LADO * escala, LADO * escala), fondo or (0, 0, 0, 0))
    for (x, y), color in dibujo.items():
        bloque = Image.new('RGBA', (escala, escala), PALETA['claro'][color])
        lienzo.paste(bloque, (x * escala, y * escala))
    return lienzo


def icono_de_inicio(dibujo: dict[tuple[int, int], str]) -> Image.Image:
    """180 px: el profesor a cinco por píxel, centrado sobre la noche."""
    lado, escala = 180, 5
    lienzo = Image.new('RGB', (lado, lado), NOCHE)
    profesor = imagen(dibujo, escala)
    margen = (lado - LADO * escala) // 2
    lienzo.paste(profesor, (margen, margen), profesor)
    return lienzo


def main() -> None:
    dibujo = pixeles()
    (APP / 'icon.svg').write_text(svg(dibujo), encoding='utf-8')
    grande = imagen(dibujo, 2)
    grande.save(
        APP / 'favicon.ico',
        format='ICO',
        sizes=[(LADO, LADO), (LADO * 2, LADO * 2)],
        append_images=[imagen(dibujo, 1)],
    )
    icono_de_inicio(dibujo).save(APP / 'apple-icon.png', optimize=True)
    for nombre in ('icon.svg', 'favicon.ico', 'apple-icon.png'):
        print(f'{nombre}: {(APP / nombre).stat().st_size} bytes')


if __name__ == '__main__':
    main()
