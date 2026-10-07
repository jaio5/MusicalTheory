"""
El profesor, píxel a píxel: la fuente de `src/ui/mascota-pixeles.ts`.

Se ejecuta desde la raíz del proyecto:

    python3 arte/mascota/build.py                 # reescribe el módulo TS
    python3 arte/mascota/build.py --muestra DIR   # y además deja muestra.png en DIR

Escribir el módulo no pide nada más que Python. La muestra pide Pillow, y es
para mirarla: el bucle de este dibujo es dibujar, mirar a 4×, corregir.

Por qué es un script y no un fichero de dibujo: la rejilla es de 32×32 y los
estados —callado, hablando, atento, el parpadeo— son **capas** que se encienden y
se apagan, no dibujos enteros repetidos. Un script las declara una vez, y la
cara que habla es la misma cara con otra boca, no una copia que pueda
desincronizarse.

Los colores son nombres, no valores: cada uno es una variable `--mascota-*` de
`src/app/globals.css`, con su valor en cada tema. Los de `PALETA` de aquí abajo
son el espejo de esos valores, solo para pintar la muestra; un test comprueba
que esta paleta y la hoja no se separan (`src/ui/Mascota.test.tsx`).
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

LADO = 32
RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / 'src/ui/mascota-pixeles.ts'

# El espejo de las variables --mascota-* de globals.css. Solo pintan la muestra.
PALETA: dict[str, dict[str, str]] = {
    'claro': {
        'contorno': '#1E2430',
        'tinta': '#1E2430',
        'cristal': '#DCE9F2',
        'cristal-luz': '#FFFFFF',
        'cristal-sombra': '#9FB2C4',
        'cristal-encendido': '#CDEFD9',
        'laton-luz': '#F0BE6E',
        'laton': '#D99A45',
        'laton-sombra': '#9A5B08',
        'laton-contorno': '#4A2A06',
        'mejilla': '#F2A0A0',
        'filamento': '#7A8591',
        'verde-vivo': '#7FD4A3',
        'verde': '#15803D',
        'halo': '#A8E3BF',
        'metal': '#6B7686',
    },
    'oscuro': {
        'contorno': '#3A4454',
        'tinta': '#1E2430',
        'cristal': '#C7D6E2',
        'cristal-luz': '#FFFFFF',
        'cristal-sombra': '#8496AA',
        'cristal-encendido': '#B9E4C9',
        'laton-luz': '#F0BE6E',
        'laton': '#D99A45',
        'laton-sombra': '#9A5B08',
        'laton-contorno': '#4A2A06',
        'mejilla': '#F2A0A0',
        'filamento': '#7A8591',
        'verde-vivo': '#7FD4A3',
        'verde': '#15803D',
        'halo': '#A8E3BF',
        'metal': '#6B7686',
    },
}

FONDOS = {'claro': '#F1F4F8', 'oscuro': '#0B0D11'}

Capa = dict[tuple[int, int], str]


def espejo(x: int) -> int:
    """La columna simétrica: el eje cae entre la 15 y la 16."""
    return LADO - 1 - x


def simetrico(pixeles: Capa) -> Capa:
    """Lo dibujado a la izquierda, repetido a la derecha."""
    salida = dict(pixeles)
    for (x, y), color in pixeles.items():
        salida[(espejo(x), y)] = color
    return salida


# ---------------------------------------------------------------- el aparato

# Media anchura de la cúpula en cada fila, contorno incluido. Arranca ancha y
# cierra de dos en dos y luego de uno en uno: con la punta estrecha salía una
# campana, o un tejado.
CUPULA = {2: 5, 3: 7, 4: 8}
MEDIA_VIDRIO = 9
VIDRIO_ARRIBA, VIDRIO_ABAJO = 2, 22
ZOCALO = {22: 10, 23: 11, 24: 11, 25: 11, 26: 11, 27: 10}
PATILLAS = (9, 15, 21)  # la columna izquierda de cada una; miden dos de ancho


def mascara_vidrio() -> set[tuple[int, int]]:
    puntos: set[tuple[int, int]] = set()
    for y in range(VIDRIO_ARRIBA, VIDRIO_ABAJO + 1):
        media = CUPULA.get(y, MEDIA_VIDRIO)
        for x in range(16 - media, 16 + media):
            puntos.add((x, y))
    # La punta donde se selló el vidrio.
    puntos |= {(14, 1), (15, 1), (16, 1), (17, 1), (15, 0), (16, 0)}
    return puntos


def mascara_zocalo() -> set[tuple[int, int]]:
    return {(x, y) for y, media in ZOCALO.items() for x in range(16 - media, 16 + media)}


def borde(mascara: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Los puntos de la máscara que tocan fuera por un lado (sin diagonales)."""
    return {
        (x, y)
        for (x, y) in mascara
        if any((x + dx, y + dy) not in mascara for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }


def dibujar_aparato() -> tuple[Capa, Capa]:
    """El cuerpo fijo y, aparte, el vidrio liso, que es lo que cambia de color."""
    cuerpo: Capa = {}
    vidrio: Capa = {}
    cristal = mascara_vidrio()
    contorno = borde(cristal)
    for punto in cristal:
        if punto in contorno:
            cuerpo[punto] = 'contorno'
        else:
            vidrio[punto] = 'cristal'

    # La luz viene de arriba a la izquierda: un reflejo vertical en esa pared y
    # la pared de enfrente en sombra.
    for y in range(5, 15):
        if (8, y) in vidrio:
            cuerpo[(8, y)] = 'cristal-luz'
    for x, y in ((9, 3), (10, 3), (9, 4), (15, 1), (16, 1)):
        if (x, y) in vidrio:
            cuerpo[(x, y)] = 'cristal-luz'
    for (x, y) in list(vidrio):
        if x >= 23 or (x == 22 and y >= 6):
            cuerpo[(x, y)] = 'cristal-sombra'
    for x in range(LADO):
        if (x, 21) in vidrio:
            cuerpo[(x, 21)] = 'cristal-sombra'
    for punto in list(cuerpo):
        vidrio.pop(punto, None)

    # El zócalo: latón con su anillo, encima del pie del vidrio.
    zocalo = mascara_zocalo()
    filo = borde(zocalo)
    for (x, y) in zocalo:
        vidrio.pop((x, y), None)
        if (x, y) in filo:
            color = 'laton-contorno'
        elif y == 23:
            color = 'laton-luz'
        elif y == 25:
            color = 'laton-sombra'
        elif x >= 24:
            color = 'laton-sombra'
        elif x == 6 and y != 25:
            color = 'laton-luz'
            color = 'laton-sombra'
        else:
            color = 'laton'
        cuerpo[(x, y)] = color

    # Las tres patillas; la del centro un punto más larga.
    for izquierda in PATILLAS:
        largo = 4 if izquierda == 15 else 3
        for y in range(28, 28 + largo):
            ultima = y == 28 + largo - 1
            cuerpo[(izquierda, y)] = 'contorno' if ultima else 'cristal-sombra'
            cuerpo[(izquierda + 1, y)] = 'contorno' if ultima else 'metal'
    return cuerpo, vidrio


# ---------------------------------------------------------------- la cara

def ojos_abiertos() -> Capa:
    ojo: Capa = {}
    for y in range(9, 13):
        for x in range(10, 13):
            ojo[(x, y)] = 'tinta'
    capa = simetrico(ojo)
    # El brillo, arriba a la izquierda en los dos: la misma luz para los dos ojos.
    capa[(10, 9)] = 'cristal-luz'
    capa[(19, 9)] = 'cristal-luz'
    return capa


def ojos_cerrados() -> Capa:
    return simetrico({(10, 11): 'tinta', (11, 11): 'tinta', (12, 11): 'tinta'})


def cejas(arriba: bool) -> Capa:
    sube = 1 if arriba else 0
    return simetrico(
        {
            (9, 7 - sube): 'tinta',
            (10, 6 - sube): 'tinta',
            (11, 6 - sube): 'tinta',
            (12, 7 - sube): 'tinta',
        }
    )


def mejillas() -> Capa:
    return simetrico({(9, 13): 'mejilla', (10, 13): 'mejilla'})


def boca_callada() -> Capa:
    return simetrico({(13, 15): 'laton-sombra', (14, 16): 'laton-sombra', (15, 16): 'laton-sombra'})


def boca_abierta(abierta: bool) -> Capa:
    """El hueco con reborde: abierta mide cuatro filas, a medias tres."""
    arriba = 14 if abierta else 15
    abajo = 17
    capa: Capa = {}
    for x in (14, 15):
        capa[(x, arriba)] = 'laton-sombra'
        capa[(x, abajo)] = 'laton-sombra'
    for y in range(arriba + 1, abajo):
        capa[(13, y)] = 'laton-sombra'
        capa[(14, y)] = 'tinta'
        capa[(15, y)] = 'tinta'
    if abierta:
        capa[(15, abajo - 1)] = 'mejilla'
    return simetrico(capa)


# ---------------------------------------------------------------- el filamento

SOPORTES = ((10, 21), (21, 20), (21, 21))


def recorrido_filamento() -> list[tuple[int, int]]:
    """El alambre en zigzag y sus dos soportes hasta el zócalo."""
    alturas = [20, 19, 18, 19, 20, 19, 18, 19, 20, 19, 18, 19]
    puntos = [(10 + i, y) for i, y in enumerate(alturas)]
    return puntos + list(SOPORTES)


def filamento(encendido: bool) -> Capa:
    """
    El alambre: gris apagado, y encendido blanco por dentro y verde alrededor.

    Encendido es el punto más claro del dibujo, porque lo que brilla es lo más
    claro de lo que lo rodea; un alambre verde sobre un cristal verde se perdía.
    """
    capa = {punto: 'cristal-luz' if encendido else 'filamento' for punto in recorrido_filamento()}
    for punto in SOPORTES:
        capa[punto] = 'verde' if encendido else 'filamento'
    return capa


def halo(lejos: bool = False) -> Capa:
    """
    El cristal calentándose alrededor del alambre: una mancha cerca y un cerco.

    Maciza y no un reborde de un píxel alrededor del zigzag: el reborde seguía la
    forma del alambre y salía una trama, como un tejido. El cerco de fuera es lo
    que late, y se dibuja aparte para poder encenderlo y apagarlo.
    """
    alambre = set(recorrido_filamento())
    cerca = {
        (x, y)
        for y, media in ((17, 5), (18, 6), (19, 7), (20, 7), (21, 7))
        for x in range(16 - media, 16 + media)
    }
    # Ni el reflejo ni la sombra de la pared: el vidrio sigue siendo redondo
    # aunque esté encendido.
    pared = {(x, y) for x in range(LADO) for y in range(LADO) if x <= 8 or x >= 22}
    if not lejos:
        return {punto: 'verde-vivo' for punto in cerca - alambre - pared}
    fuera = {
        (x, y)
        for y, media in ((15, 3), (16, 5), (17, 6), (18, 7))
        for x in range(16 - media, 16 + media)
    }
    return {punto: 'halo' for punto in fuera - cerca - alambre - pared}


# ---------------------------------------------------------------- composición

def capas() -> dict[str, Capa]:
    cuerpo, vidrio = dibujar_aparato()
    return {
        'vidrio': vidrio,
        'cuerpo': {**cuerpo, **mejillas()},
        'halo': halo(),
        'haloLejos': halo(lejos=True),
        'filamentoApagado': filamento(False),
        'filamentoEncendido': filamento(True),
        'cejas': cejas(False),
        'cejasArriba': cejas(True),
        'ojosAbiertos': ojos_abiertos(),
        'ojosCerrados': ojos_cerrados(),
        'bocaCallada': boca_callada(),
        'bocaAbierta': boca_abierta(True),
        'bocaMedia': boca_abierta(False),
    }


def estado(todas: dict[str, Capa], nombres: list[str]) -> Capa:
    salida: Capa = {}
    for nombre in nombres:
        salida.update(todas[nombre])
    return salida


ESTADOS = {
    'callado': ['vidrio', 'cuerpo', 'filamentoApagado', 'cejas', 'ojosAbiertos', 'bocaCallada'],
    'hablando': ['vidrio', 'cuerpo', 'filamentoApagado', 'cejasArriba', 'ojosAbiertos', 'bocaAbierta'],
    'hablando-2': ['vidrio', 'cuerpo', 'filamentoApagado', 'cejasArriba', 'ojosAbiertos', 'bocaMedia'],
    'atento': ['vidrio', 'cuerpo', 'haloLejos', 'halo', 'filamentoEncendido', 'cejas', 'ojosAbiertos', 'bocaCallada'],
    'atento-2': ['vidrio', 'cuerpo', 'halo', 'filamentoEncendido', 'cejas', 'ojosAbiertos', 'bocaCallada'],
    'parpadeo': ['vidrio', 'cuerpo', 'filamentoApagado', 'cejas', 'ojosCerrados', 'bocaCallada'],
    'atento-hablando': [
        'vidrio', 'cuerpo', 'haloLejos', 'halo', 'filamentoEncendido', 'cejasArriba', 'ojosAbiertos',
        'bocaAbierta',
    ],
}


# ---------------------------------------------------------------- salida

def trazos(capa: Capa) -> list[tuple[str, str]]:
    """
    Un `d` por color, hecho de rectángulos: `M x y h ancho v alto h-ancho z`.

    Los tramos de cada fila se juntan con los de las filas de abajo que empiezan
    y acaban igual, así que una pared de un píxel de ancho es un rectángulo y no
    veinte. El módulo pesa la mitad y el dibujo es el mismo.
    """
    por_color: dict[str, set[tuple[int, int]]] = {}
    for punto, color in capa.items():
        por_color.setdefault(color, set()).add(punto)
    salida = []
    for color in sorted(por_color):
        puntos = por_color[color]
        tramos: list[tuple[int, int, int]] = []  # (y, x, ancho)
        for y in range(LADO):
            x = 0
            while x < LADO:
                if (x, y) in puntos:
                    inicio = x
                    while (x, y) in puntos:
                        x += 1
                    tramos.append((y, inicio, x - inicio))
                else:
                    x += 1
        abiertos: dict[tuple[int, int], list[int]] = {}  # (x, ancho) -> [y, alto]
        rectangulos: list[tuple[int, int, int, int]] = []
        for y, x, ancho in tramos:
            previo = abiertos.get((x, ancho))
            if previo and previo[0] + previo[1] == y:
                previo[1] += 1
            else:
                if previo:
                    rectangulos.append((previo[0], x, ancho, previo[1]))
                abiertos[(x, ancho)] = [y, 1]
        rectangulos += [(y, x, ancho, alto) for (x, ancho), (y, alto) in abiertos.items()]
        rectangulos.sort()
        salida.append(
            (color, ''.join(f'M{x} {y}h{ancho}v{alto}h-{ancho}z' for y, x, ancho, alto in rectangulos))
        )
    return salida


CABECERA = """\
/*
 * GENERADO por arte/mascota/build.py. No se edita a mano: se cambia el script y
 * se vuelve a ejecutar (`python3 arte/mascota/build.py`).
 *
 * Cada capa es una lista de trazos, uno por color, hechos de rectángulos de un
 * píxel de alto sobre una rejilla de 32×32. El color es el nombre de una
 * variable `--mascota-*` de globals.css, no un valor: así cambia con el tema.
 */
"""


def escribir_ts(todas: dict[str, Capa]) -> None:
    # `cristal-encendido` no lo pinta ninguna capa: es el color que toma el vidrio
    # cuando escucha, y lo elige el componente.
    colores = sorted({c for capa in todas.values() for c in capa.values()} | {'cristal-encendido'})
    lineas = [CABECERA]
    lineas.append('/** Los colores del muñeco; cada uno es `var(--mascota-<nombre>)`. */')
    lineas.append('export const COLORES_MASCOTA = [')
    lineas += [f"  '{c}'," for c in colores]
    lineas.append('] as const;')
    lineas.append('')
    lineas.append('export type ColorMascota = (typeof COLORES_MASCOTA)[number];')
    lineas.append('')
    lineas.append('export interface Trazo {')
    lineas.append('  readonly color: ColorMascota;')
    lineas.append('  readonly d: string;')
    lineas.append('}')
    lineas.append('')
    lineas.append(f'/** El lado de la rejilla, en píxeles: el `viewBox` es 0 0 {LADO} {LADO}. */')
    lineas.append(f'export const LADO_MASCOTA = {LADO};')
    lineas.append('')
    lineas.append('export const CAPAS_MASCOTA = {')
    for nombre, capa in todas.items():
        lineas.append(f'  {nombre}: [')
        for color, d in trazos(capa):
            lineas.append(f"    {{ color: '{color}', d: '{d}' }},")
        lineas.append('  ],')
    lineas.append('} as const satisfies Record<string, readonly Trazo[]>;')
    lineas.append('')
    SALIDA.write_text('\n'.join(lineas), encoding='utf-8')
    # Prettier decide dónde se parte cada línea; sin él el `format:check` falla.
    subprocess.run(['pnpm', 'exec', 'prettier', '--write', str(SALIDA)], cwd=RAIZ, check=True,
                   stdout=subprocess.DEVNULL)


def muestra(todas: dict[str, Capa], carpeta: Path, escala: int = 4) -> None:
    """Los estados uno al lado de otro, a `escala`, sobre los dos fondos."""
    from PIL import Image, ImageDraw

    nombres = list(ESTADOS)
    hueco = 8
    ancho = len(nombres) * (LADO * escala + hueco) + hueco
    alto = 2 * (LADO * escala + hueco) + hueco
    lienzo = Image.new('RGB', (ancho, alto))
    pincel = ImageDraw.Draw(lienzo)
    for fila, tema in enumerate(('claro', 'oscuro')):
        y0 = fila * (LADO * escala + hueco)
        pincel.rectangle([0, y0, ancho, y0 + LADO * escala + 2 * hueco], fill=FONDOS[tema])
        for columna, nombre in enumerate(nombres):
            x0 = hueco + columna * (LADO * escala + hueco)
            pixeles = estado(todas, ESTADOS[nombre])
            for (x, y), color in pixeles.items():
                if nombre.startswith('atento') and color == 'cristal':
                    color = 'cristal-encendido'
                pincel.rectangle(
                    [x0 + x * escala, y0 + hueco + y * escala,
                     x0 + (x + 1) * escala - 1, y0 + hueco + (y + 1) * escala - 1],
                    fill=PALETA[tema][color],
                )
    carpeta.mkdir(parents=True, exist_ok=True)
    lienzo.save(carpeta / 'muestra.png')


def main() -> None:
    argumentos = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    argumentos.add_argument('--muestra', type=Path, help='carpeta donde dejar muestra.png')
    argumentos.add_argument('--sin-ts', action='store_true', help='no reescribir el módulo')
    opciones = argumentos.parse_args()
    todas = capas()
    if not opciones.sin_ts:
        escribir_ts(todas)
    if opciones.muestra:
        muestra(todas, opciones.muestra)


if __name__ == '__main__':
    main()
