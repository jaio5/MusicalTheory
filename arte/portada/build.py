"""
La portada, píxel a píxel: un local de ensayo de noche.

Se ejecuta desde la raíz del proyecto:

    python3 arte/portada/build.py                 # reescribe las imágenes y el módulo TS
    python3 arte/portada/build.py --muestra DIR   # y además deja las láminas en DIR

Pide Pillow, porque lo que escribe son PNG
([adr/0069](../../docs/adr/0069-la-portada-es-una-escena-de-pixel.md)).

**Por qué PNG y no rectángulos de SVG, como la mascota.** La mascota cambia de
color con el tema y por eso pinta con variables. La escena no: va siempre en su
marco oscuro, como iba el vídeo, así que no gana nada pintando con variables. Y
son 27.648 píxeles con textura —la rejilla del altavoz, la espuma de la pared,
la luz de la bombilla tramada— que como rectángulos serían decenas de miles de
números en el HTML; un PNG con paleta los guarda en unos pocos kilobytes.

**Tres capas a distinta profundidad**, cada una un PNG del tamaño del lienzo con
lo de las otras transparente: la pared (`fondo`), el suelo con lo que hay encima
(`medio`) y lo que queda entre la cámara y el ampli (`frente`). La portada las
desplaza por separado y eso es el paralaje. **Y una hoja de lo que se mueve**
(`vida`): cada cosa que late es una tira de fotogramas que la hoja de estilos
recorre a saltos. El primer fotograma de cada tira está vacío, porque lo que se
ve quieto ya está pintado en su capa: sin la hoja, la escena sale entera.

**La mascota no se dibuja aquí**: se lee de `arte/mascota/build.py`, con sus
capas y su paleta de tema oscuro, que es el fondo sobre el que va. Si el profesor
cambia, se vuelve a ejecutar esto y cambia también en la portada.

Lo que escribe:

- `src/app/_escena/{fondo,medio,frente,vida}.png`, que importa la hoja de la
  escena con `url()`, así que llegan con huella en el nombre y caché larga.
- `src/app/escena-pixeles.ts`, con las medidas y dónde está cada tira. No se
  edita a mano.
"""

from __future__ import annotations

import argparse
import importlib.util
import math
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CARPETA = RAIZ / 'src/app/_escena'
MODULO = RAIZ / 'src/app/escena-pixeles.ts'

# El dibujo se compone en un marco de 192×144 —`ANCHO` y `ALTO`, y todas las
# coordenadas de aquí abajo— y se guarda en un lienzo algo mayor, con pared y suelo
# de sobra alrededor: `MARGEN` por cada lado. Es lo que deja que el paralaje no
# enseñe nunca el borde y que la caja, que cambia de ancho y de proporción, recorte
# por donde no importa. La pared y el suelo se pintan en todo el lienzo; las
# cosas, solo dentro del marco.
ANCHO, ALTO = 192, 144
MARGEN = (12, 10)
LIENZO_ANCHO, LIENZO_ALTO = ANCHO + 2 * MARGEN[0], ALTO + 2 * MARGEN[1]
# Lo que se ve en la caja más pequeña que hay de verdad —un teléfono de 360 a dos
# píxeles por punto—, en coordenadas del marco. Lo importante va aquí dentro.
SEGURO = (36, 24, 120, 96)  # x, y, ancho, alto
# El primer y el último punto del lienzo, en coordenadas del marco.
X0, X1 = -MARGEN[0], ANCHO + MARGEN[0]
Y0, Y1 = -MARGEN[1], ALTO + MARGEN[1]

# ---------------------------------------------------------------- la paleta

PALETA: dict[str, str] = {
    # Grafito, de la sombra a la luz: los fondos de `tokens.ts` y dos más abajo.
    'negro': '#07090C',
    'fondo': '#0B0D11',
    'grafito-1': '#131720',
    'grafito-2': '#1C222D',
    'grafito-3': '#2A313D',
    'grafito-4': '#3A4454',
    'metal': '#6B7686',
    'acero': '#98A3B3',
    # La pared donde le da la bombilla: el mismo grafito, templado.
    'pared-calida-1': '#2A2621',
    'pared-calida-2': '#3B342B',
    'pared-calida-3': '#54473A',
    # Latón: el acento de la casa en sus cuatro luces, y el blanco de la bombilla.
    'laton-contorno': '#4A2A06',
    'laton-sombra': '#9A5B08',
    'laton': '#D99A45',
    'laton-luz': '#F0BE6E',
    'bombilla': '#FFF3D6',
    # Verde válvula: el de `tube` en sus dos temas y el resplandor sobre la pared.
    'verde-pared': '#16302A',
    'verde-apagado': '#1F4536',
    'verde': '#2F6B4E',
    'verde-vivo': '#7FD4A3',
    'halo': '#A8E3BF',
    # El rojo de la alfombra y el del piloto.
    'rojo-oscuro': '#2A1418',
    'rojo': '#4A1E24',
    'rojo-medio': '#73303A',
    'rojo-vivo': '#E0565F',
    'coral': '#FF9494',
    # La madera del suelo y del mástil: lo único pardo, y casi negro.
    'madera-1': '#16120F',
    'madera-2': '#211A15',
    'madera-3': '#2E241C',
    'madera': '#6B4520',
}

Punto = tuple[int, int]

BAYER = (
    (0, 8, 2, 10),
    (12, 4, 14, 6),
    (3, 11, 1, 9),
    (15, 7, 13, 5),
)


def umbral(x: int, y: int) -> float:
    """El umbral de la trama ordenada en ese punto, entre 0 y 1."""
    return (BAYER[y % 4][x % 4] + 0.5) / 16


class Capa:
    """Una rejilla de nombres de color; `None` es transparente."""

    def __init__(self, ancho: int | None = None, alto: int | None = None) -> None:
        # Sin medidas es una capa del lienzo entero, y se dibuja en coordenadas
        # del marco: el origen cae `MARGEN` dentro. Con medidas es una pieza
        # suelta —un fotograma, la mascota— y su origen es su esquina.
        entera = ancho is None
        self.ancho = LIENZO_ANCHO if entera else ancho
        self.alto = LIENZO_ALTO if entera else alto
        self.origen = MARGEN if entera else (0, 0)
        self.p: list[list[str | None]] = [[None] * self.ancho for _ in range(self.alto)]

    def px(self, x: int, y: int, color: str | None) -> None:
        x, y = x + self.origen[0], y + self.origen[1]
        if 0 <= x < self.ancho and 0 <= y < self.alto:
            self.p[y][x] = color

    def get(self, x: int, y: int) -> str | None:
        x, y = x + self.origen[0], y + self.origen[1]
        if 0 <= x < self.ancho and 0 <= y < self.alto:
            return self.p[y][x]
        return None

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: str | None) -> None:
        """Relleno, con los dos extremos dentro."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, color)

    def marco(self, x0: int, y0: int, x1: int, y1: int, color: str) -> None:
        for x in range(x0, x1 + 1):
            self.px(x, y0, color)
            self.px(x, y1, color)
        for y in range(y0, y1 + 1):
            self.px(x0, y, color)
            self.px(x1, y, color)

    def linea(self, x0: int, y0: int, x1: int, y1: int, color: str) -> None:
        """Bresenham: nunca dobla un píxel en las esquinas."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        error = dx + dy
        while True:
            self.px(x0, y0, color)
            if x0 == x1 and y0 == y1:
                return
            doble = 2 * error
            if doble >= dy:
                error += dy
                x0 += sx
            if doble <= dx:
                error += dx
                y0 += sy

    def pegar(self, otra: Capa, dx: int, dy: int) -> None:
        """Una pieza suelta encima, con su esquina en (dx, dy) del marco."""
        for y in range(otra.alto):
            for x in range(otra.ancho):
                color = otra.p[y][x]
                if color is not None:
                    self.px(x + dx, y + dy, color)

    def recorte(self, x: int, y: int, ancho: int, alto: int) -> Capa:
        salida = Capa(ancho, alto)
        for j in range(alto):
            for i in range(ancho):
                salida.p[j][i] = self.get(x + i, y + j)
        return salida

    def imagen(self):
        from PIL import Image

        imagen = Image.new('RGBA', (self.ancho, self.alto), (0, 0, 0, 0))
        for y in range(self.alto):
            for x in range(self.ancho):
                color = self.p[y][x]
                if color is not None:
                    valor = PALETA[color]
                    imagen.putpixel(
                        (x, y), (int(valor[1:3], 16), int(valor[3:5], 16), int(valor[5:7], 16), 255)
                    )
        return imagen


def elipse(cx: float, cy: float, rx: float, ry: float) -> set[Punto]:
    """Los puntos dentro de una elipse, medidos desde el centro de cada píxel."""
    return {
        (x, y)
        for y in range(math.floor(cy - ry), math.ceil(cy + ry) + 1)
        for x in range(math.floor(cx - rx), math.ceil(cx + rx) + 1)
        if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
    }


def borde(mascara: set[Punto]) -> set[Punto]:
    """Lo de la máscara que toca fuera por un lado (sin diagonales)."""
    return {
        (x, y)
        for (x, y) in mascara
        if any((x + dx, y + dy) not in mascara for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }


def hondura(mascara: set[Punto]) -> dict[Punto, int]:
    """Cuántos pasos hay desde cada punto hasta salir de la máscara."""
    distancia = {punto: 1 for punto in borde(mascara)}
    frente = list(distancia)
    while frente:
        siguiente = []
        for x, y in frente:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                vecino = (x + dx, y + dy)
                if vecino in mascara and vecino not in distancia:
                    distancia[vecino] = distancia[(x, y)] + 1
                    siguiente.append(vecino)
        frente = siguiente
    return distancia


# ---------------------------------------------------------------- la luz

# Una bombilla desnuda colgada a la izquierda del ampli. Es la única luz de la
# sala además de las válvulas, y de ella sale todo el sombreado: lo de arriba a
# la izquierda de cada cosa es lo que mira hacia aquí.
BOMBILLA = (58, 27)


def luz(x: int, y: int, alcance: float = 62.0) -> float:
    """Cuánto le llega de la bombilla a un punto: 1 al lado, 0 lejos."""
    bx, by = BOMBILLA
    # Más ancha que alta: la pantalla de luz de una bombilla colgada se abre a
    # los lados y cae en el suelo.
    distancia = math.hypot((x - bx) / 1.25, (y - by))
    return max(0.0, 1 - distancia / alcance)


RAMPA_PARED = ['negro', 'fondo', 'grafito-1', 'grafito-2', 'grafito-3', 'grafito-4']
# Cerca de la bombilla la pared se templa: los tres escalones de arriba pasan a
# un gris cálido. Es lo que hace que se lea como luz y no como una pared más clara.
RAMPA_CALIDA = ['negro', 'fondo', 'grafito-1', 'pared-calida-1', 'pared-calida-2', 'pared-calida-3']
RAMPA_SUELO = ['negro', 'madera-1', 'madera-2', 'madera-3']


def tramado(x: int, y: int, valor: float, rampa: list[str]) -> str:
    """Un valor continuo llevado a la rampa con trama ordenada, sin bandas."""
    entero = math.floor(valor)
    if valor - entero > umbral(x, y):
        entero += 1
    return rampa[max(0, min(len(rampa) - 1, entero))]


# ---------------------------------------------------------------- el fondo

def pared() -> Capa:
    """
    La pared de espuma: tejas de cuñas que cambian de sentido de una a otra.

    Es lo que tiene cualquier local de ensayo y se reconoce por el dibujo, no por
    el color: un damero de rayas a lo largo y a lo ancho. Las cuñas reciben la
    luz por arriba y por la izquierda, y la bombilla aclara la pared alrededor.
    """
    capa = Capa()
    lado = 12
    for y in range(Y0, Y1):
        for x in range(X0, X1):
            # El techo: una viga oscura arriba del todo.
            if y < 3:
                capa.px(x, y, 'negro' if y < 2 else 'fondo')
                continue
            teja_x, teja_y = (x + 48) // lado, (y - 3) // lado
            dentro_x, dentro_y = (x + 48) % lado, (y - 3) % lado
            horizontal = (teja_x + teja_y) % 2 == 0
            fase = (dentro_y if horizontal else dentro_x) % 3
            relieve = (1, 0, -1)[fase]
            # La junta entre tejas, un poco más honda.
            if dentro_x == 0 or dentro_y == 0:
                relieve = -1
            cuanta = luz(x, y)
            # El relieve pesa menos lejos de la luz: la pared es lo de detrás, y
            # con el mismo contraste que el ampli competía con él.
            valor = 1.5 + relieve * (0.45 + cuanta * 0.6) + cuanta * 3.6 - vineta(x, y)
            rampa = RAMPA_CALIDA if cuanta > 0.62 - umbral(x, y) * 0.12 else RAMPA_PARED
            capa.px(x, y, tramado(x, y, valor, rampa))
    return capa


def vineta(x: int, y: int) -> float:
    """Lo que se apaga hacia los cantos: la sala acaba en oscuro, no en un borde."""
    dx = (x - ANCHO / 2) / (ANCHO / 2)
    dy = (y - ALTO / 2) / (ALTO / 2)
    return max(0.0, math.hypot(dx, dy) - 0.55) * 1.6


def bombilla(capa: Capa) -> None:
    bx, by = BOMBILLA
    for y in range(Y0, by - 5):
        capa.px(bx, y, 'grafito-4')
    # El portalámparas.
    capa.rect(bx - 1, by - 5, bx + 1, by - 3, 'metal')
    capa.px(bx - 1, by - 5, 'acero')
    capa.px(bx + 1, by - 3, 'grafito-4')
    # El cristal: el centro blanco, el resto en latón encendido.
    filas = {by - 2: 2, by - 1: 3, by: 3, by + 1: 3, by + 2: 2, by + 3: 1}
    for y, media in filas.items():
        for x in range(bx - media, bx + media + 1):
            capa.px(x, y, 'laton')
    for y, media in {by - 1: 2, by: 2, by + 1: 2, by + 2: 1}.items():
        for x in range(bx - media, bx + media + 1):
            capa.px(x, y, 'laton-luz')
    for x, y in ((bx - 1, by - 1), (bx, by - 1), (bx - 1, by), (bx, by), (bx - 1, by + 1)):
        capa.px(x, y, 'bombilla')
    # La rosca de abajo, más oscura: el cristal no es del mismo blanco entero.
    capa.px(bx, by + 3, 'laton-sombra')


def cartel(capa: Capa) -> None:
    """Un cartel de concierto pegado con cinta: un disco y unas líneas, sin letra."""
    x0, y0, x1, y1 = 37, 40, 53, 62
    capa.rect(x0 + 1, y0 + 1, x1 + 1, y1 + 1, 'negro')  # su sombra en la pared
    capa.rect(x0, y0, x1, y1, 'rojo-medio')
    capa.rect(x0, y0, x1, y0 + 3, 'laton')
    for x in range(x0 + 2, x1 - 1, 2):
        capa.px(x, y0 + 1, 'laton-contorno')
        capa.px(x, y0 + 2, 'laton-contorno')
    # El disco, con sus surcos y la galleta en latón.
    cx, cy = (x0 + x1 + 1) / 2, 52
    disco = elipse(cx, cy, 6.5, 6.5)
    for punto in disco:
        capa.px(*punto, 'negro')
    for punto in elipse(cx, cy, 4.5, 4.5) - elipse(cx, cy, 3.5, 3.5):
        capa.px(*punto, 'grafito-2')
    for punto in elipse(cx, cy, 2, 2):
        capa.px(*punto, 'laton')
    capa.px(int(cx) - 4, int(cy) - 4, 'grafito-3')  # el brillo del vinilo
    capa.px(int(cx) - 3, int(cy) - 5, 'grafito-3')
    # Tres renglones de letra que no se lee.
    for y, ancho in ((y1 - 3, 11), (y1 - 1, 7)):
        for x in range(x0 + 3, x0 + 3 + ancho):
            if (x * 7 + y) % 5 != 0:
                capa.px(x, y, 'laton-luz' if y == y1 - 3 else 'laton')
    # La cinta de las esquinas de arriba.
    for x, y in ((x0, y0), (x0 + 1, y0), (x1, y0), (x1 - 1, y0)):
        capa.px(x, y, 'acero')


def neon(capa: Capa, encendido: str = 'pleno') -> None:
    """
    Dos corcheas de neón en la pared: el verde de la casa, encendido.

    `pleno` es como se ve casi siempre; `apagado` y `tenue` son los dos
    fotogramas del parpadeo, que pinta la hoja de lo que se mueve.
    """
    tubo = {'pleno': 'halo', 'tenue': 'verde-vivo', 'apagado': 'verde-apagado'}[encendido]
    funda = {'pleno': 'verde-vivo', 'tenue': 'verde', 'apagado': 'verde-apagado'}[encendido]
    trazos: set[Punto] = set()
    # Las dos cabezas, las plicas y la barra que las une.
    for punto in elipse(142.5, 51, 2.2, 1.6) | elipse(149.5, 49, 2.2, 1.6):
        trazos.add(punto)
    for y in range(39, 51):
        trazos.add((144, y))
    for y in range(37, 49):
        trazos.add((151, y))
    for i in range(0, 8):
        x = 144 + i
        y = 39 - round(i * 2 / 7)
        trazos.add((x, y))
        trazos.add((x, y + 1))
    # El resplandor en la pared, tramado y solo encendido.
    if encendido != 'apagado':
        alcance = 3.5 if encendido == 'pleno' else 2.0
        for y in range(32, 58):
            for x in range(134, 158):
                if (x, y) in trazos:
                    continue
                cerca = min(math.hypot(x - tx, y - ty) for tx, ty in trazos)
                if cerca <= alcance and (1 - cerca / alcance) * 1.4 > umbral(x, y):
                    capa.px(x, y, 'verde-pared')
    for x, y in trazos:
        capa.px(x, y, funda)
    # El alma del tubo, más clara, solo donde el trazo es grueso: la barra y las
    # cabezas. En la plica de un píxel la funda y el alma son lo mismo.
    if encendido != 'apagado':
        for x, y in trazos:
            vecinos = sum((x + dx, y + dy) in trazos for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if vecinos >= 3:
                capa.px(x, y, tubo)


def dibujar_fondo() -> Capa:
    capa = pared()
    cartel(capa)
    neon(capa)
    bombilla(capa)
    return capa


# ---------------------------------------------------------------- el medio

SUELO = 98  # la primera fila del suelo
JUNTAS = (98, 102, 107, 113, 120, 128, 137, 147)


def suelo(capa: Capa) -> None:
    """La tarima: tablas que se ensanchan al acercarse, con la luz encima."""
    # El zócalo, que es de la pared pero va con el suelo: si fuera con la pared,
    # el paralaje lo metería por debajo de la tarima.
    for x in range(X0, X1):
        capa.px(x, SUELO - 4, 'grafito-3')
        capa.px(x, SUELO - 3, 'grafito-2')
        capa.px(x, SUELO - 2, 'grafito-2')
        capa.px(x, SUELO - 1, 'negro')
    for y in range(SUELO, Y1):
        for x in range(X0, X1):
            valor = 1.1 + luz(x, y, 78) * 2.8 - vineta(x, y) * 0.8
            capa.px(x, y, tramado(x, y, valor, RAMPA_SUELO))
    for indice, y in enumerate(JUNTAS):
        for x in range(X0, X1):
            capa.px(x, y, 'negro')
        # Las juntas de testa, al tresbolillo, cada vez más separadas.
        if indice + 1 < len(JUNTAS):
            siguiente = JUNTAS[indice + 1]
            paso = 34 + indice * 6
            for x in range(X0 + (indice * 17) % paso, X1, paso):
                for yy in range(y + 1, siguiente):
                    capa.px(x, yy, 'negro')


def alfombra(capa: Capa) -> None:
    """
    La alfombra persa de todo local de ensayo, en el rojo de la casa.

    Es lo único cálido del suelo, y está ahí para que el ampli no flote: sin ella,
    la pila negra sobre la tarima negra no tocaba el suelo.
    """
    arriba, abajo = 105, 133

    def bordes(y: int) -> tuple[int, int]:
        avance = (y - arriba) * 0.45
        return round(64 - avance), round(156 + avance)

    for y in range(arriba, abajo + 1):
        izquierda, derecha = bordes(y)
        for x in range(izquierda, derecha + 1):
            desde_borde = min(x - izquierda, derecha - x, y - arriba, abajo - y)
            if desde_borde == 0:
                color = 'rojo-oscuro'
            elif desde_borde <= 2:
                color = 'rojo-medio'
            elif desde_borde == 3:
                color = 'laton-sombra' if (x + y) % 2 == 0 else 'rojo-medio'
            else:
                color = 'rojo'
            capa.px(x, y, color)
        # El medallón del centro: un rombo.
        centro = (izquierda + derecha) / 2
        alto_rombo = 9
        medio = (arriba + abajo) / 2
        ancho_fila = (alto_rombo - abs(y - medio)) * 2.4
        if ancho_fila > 0:
            for x in range(round(centro - ancho_fila), round(centro + ancho_fila) + 1):
                anillo = abs(x - centro) / 2.4 + abs(y - medio)
                capa.px(x, y, 'laton-sombra' if anillo < 2 else ('rojo-medio' if anillo < 6 else 'rojo'))
    # Los flecos de los dos lados cortos.
    for y, sentido in ((arriba - 1, -1), (abajo + 1, 1)):
        izquierda, derecha = bordes(y - sentido)
        for x in range(izquierda + 1, derecha, 2):
            capa.px(x, y, 'acero' if y > 120 else 'metal')


def sombra(capa: Capa, x0: int, x1: int, y: int, alto: int = 2) -> None:
    """La sombra de contacto de algo apoyado: un punto más oscuro de lo que pisa."""
    oscurecer = {
        'rojo': 'rojo-oscuro',
        'rojo-medio': 'rojo',
        'laton-sombra': 'rojo',
        'madera-3': 'madera-1',
        'madera-2': 'madera-1',
        'madera-1': 'negro',
        'rojo-oscuro': 'negro',
        'acero': 'metal',
        'metal': 'grafito-3',
    }
    for yy in range(y, y + alto):
        for x in range(x0 + (yy - y), x1 + 1 - (yy - y)):
            color = capa.get(x, yy)
            if color in oscurecer:
                capa.px(x, yy, oscurecer[color])


# El ampli: una pantalla de dos conos con el cabezal encima.
PANTALLA = (85, 74, 138, 113)
CABEZAL = (85, 58, 138, 73)


def tolex(capa: Capa, x0: int, y0: int, x1: int, y1: int, semilla: int) -> None:
    """La caja forrada: grafito con su grano, luz arriba a la izquierda."""
    capa.rect(x0, y0, x1, y1, 'grafito-2')
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            # El grano del vinilo, poco y repartido: solo se nota de cerca.
            if (x * 73 + y * 151 + semilla) % 23 == 0:
                capa.px(x, y, 'grafito-3')
            elif (x * 37 + y * 91 + semilla) % 29 == 0:
                capa.px(x, y, 'grafito-1')
    for x in range(x0, x1 + 1):
        capa.px(x, y0 + 1, 'grafito-3')
        capa.px(x, y1 - 1, 'grafito-1')
    for y in range(y0 + 1, y1):
        capa.px(x0 + 1, y, 'grafito-3')
        capa.px(x1 - 1, y, 'grafito-1')
    capa.marco(x0, y0, x1, y1, 'negro')
    # El canto de arriba recibe la bombilla: un filo de luz cálida en la mitad
    # que mira hacia ella.
    for x in range(x0 + 1, x0 + (x1 - x0) // 2):
        capa.px(x, y0 + 1, 'grafito-4')


def esquinas(capa: Capa, x0: int, y0: int, x1: int, y1: int) -> None:
    """Los cantoneros de metal, en L."""
    for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        for i in range(3):
            capa.px(cx + sx * i, cy, 'metal')
            capa.px(cx, cy + sy * i, 'metal')
        capa.px(cx + sx, cy + sy, 'grafito-4')
        capa.px(cx, cy, 'acero' if sx == 1 and sy == 1 else 'metal')


def pantalla(capa: Capa) -> None:
    x0, y0, x1, y1 = PANTALLA
    tolex(capa, x0, y0, x1, y1, semilla=3)
    # La rejilla: tela de malla sobre dos conos que se adivinan detrás.
    gx0, gy0, gx1, gy1 = x0 + 4, y0 + 4, x1 - 4, y1 - 5
    conos = [elipse(gx0 + 12.5, (gy0 + gy1 + 1) / 2, 10, 10), elipse(gx1 - 11.5, (gy0 + gy1 + 1) / 2, 10, 10)]
    centros = [elipse(gx0 + 12.5, (gy0 + gy1 + 1) / 2, 3, 3), elipse(gx1 - 11.5, (gy0 + gy1 + 1) / 2, 3, 3)]
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            malla = (x + y) % 2 == 0
            en_cono = any((x, y) in cono for cono in conos)
            en_centro = any((x, y) in centro for centro in centros)
            if en_centro:
                color = 'grafito-3' if malla else 'grafito-2'
            elif en_cono:
                color = 'grafito-2' if malla else 'grafito-1'
            else:
                color = 'grafito-3' if malla else 'grafito-2'
            # La luz de la bombilla sobre la tela, en la esquina de arriba.
            if malla and luz(x, y) > 0.38 and color == 'grafito-3':
                color = 'grafito-4'
            capa.px(x, y, color)
    # El ribete de latón alrededor de la tela.
    capa.marco(gx0 - 1, gy0 - 1, gx1 + 1, gy1 + 1, 'laton-sombra')
    for x in range(gx0 - 1, gx1 + 1):
        capa.px(x, gy0 - 1, 'laton')
    for y in range(gy0 - 1, gy1 + 1):
        capa.px(gx0 - 1, y, 'laton')
    capa.px(gx0 - 1, gy0 - 1, 'laton-luz')
    capa.px(gx0, gy0 - 1, 'laton-luz')
    # La placa del frente: latón con su contorno y un rótulo que no se lee.
    px0, py0 = gx0 + 2, gy1 - 4
    capa.rect(px0, py0, px0 + 9, py0 + 2, 'laton')
    capa.marco(px0 - 1, py0 - 1, px0 + 10, py0 + 3, 'laton-contorno')
    for x in range(px0, px0 + 10):
        capa.px(x, py0, 'laton-luz')
    for x in range(px0 + 1, px0 + 9, 2):
        capa.px(x, py0 + 1, 'laton-sombra')
    esquinas(capa, x0, y0, x1, y1)
    # Las patas.
    for x in (x0 + 3, x0 + 4, x1 - 4, x1 - 3):
        capa.px(x, y1 + 1, 'negro')


def cabezal(capa: Capa) -> None:
    x0, y0, x1, y1 = CABEZAL
    tolex(capa, x0, y0, x1, y1, semilla=11)
    # Las rendijas de arriba, con el ámbar de las válvulas detrás.
    for x, y, color in rendijas('viva'):
        capa.px(x, y, color)
    # El panel de latón.
    fx0, fy0, fx1, fy1 = x0 + 3, y0 + 6, x1 - 3, y1 - 3
    capa.rect(fx0, fy0, fx1, fy1, 'laton')
    for x in range(fx0, fx1 + 1):
        capa.px(x, fy0, 'laton-luz')
        capa.px(x, fy1, 'laton-sombra')
    capa.px(fx1, fy0, 'laton')
    capa.marco(fx0 - 1, fy0 - 1, fx1 + 1, fy1 + 1, 'laton-contorno')
    # El vúmetro: siete luces en su ventana, encendidas hasta la cuarta.
    for x, y, color in vumetro(4):
        capa.px(x, y, color)
    # Cinco mandos: negros, con el brillo arriba a la izquierda y la raya blanca.
    for i in range(5):
        kx = VUMETRO[0] + 18 + i * 5
        capa.rect(kx, fy0 + 1, kx + 2, fy0 + 3, 'negro')
        capa.px(kx, fy0 + 1, 'metal')
        capa.px(kx + 1, fy0 + 1, 'acero' if i % 2 == 0 else 'grafito-4')
        capa.px(kx + 1 + (i % 3) - 1, fy0 + 2 if i % 3 != 1 else fy0 + 1, 'acero')
        capa.px(kx + 2, fy0 + 4, 'laton-sombra')  # su marca en el panel
    # El piloto: una joya roja encendida.
    for x, y, color in piloto('pleno'):
        capa.px(x, y, color)


# Dónde caen las piezas que se mueven: la hoja de estilos las pone ahí encima.
RENDIJAS = (92, 60, 40, 2)  # x, y, ancho, alto
VUMETRO = (90, 65, 15, 4)
PILOTO = (131, 65, 4, 4)
NEON = (134, 32, 24, 26)


def rendijas(estado: str) -> list[tuple[int, int, str]]:
    """Las cuatro rendijas del cabezal, con la luz de cada válvula detrás."""
    rx, ry, ancho, _ = RENDIJAS
    salida = []
    for i in range(4):
        x0 = rx + i * 10
        for x in range(x0, x0 + 7):
            borde_rendija = x in (x0, x0 + 6)
            if estado == 'viva':
                arriba, abajo = ('laton-sombra', 'laton') if borde_rendija else ('laton', 'laton-luz')
            elif estado == 'tenue':
                arriba, abajo = ('laton-contorno', 'laton-sombra') if borde_rendija else ('laton-sombra', 'laton')
            else:  # 'brillo': la válvula de en medio sube un punto
                arriba, abajo = ('laton', 'laton-luz') if borde_rendija else ('laton-luz', 'bombilla')
            salida.append((x, ry, arriba))
            salida.append((x, ry + 1, abajo))
    return salida


def vumetro(nivel: int) -> list[tuple[int, int, str]]:
    """La ventana del vúmetro con `nivel` luces encendidas, de siete."""
    vx, vy, ancho, alto = VUMETRO
    salida = [(x, y, 'negro') for y in range(vy, vy + alto) for x in range(vx, vx + ancho)]
    encendidas = ['verde-vivo'] * 4 + ['laton-luz'] * 2 + ['coral']
    apagadas = ['verde-apagado'] * 4 + ['laton-contorno'] * 2 + ['rojo']
    for i in range(7):
        x = vx + 1 + i * 2
        color = encendidas[i] if i < nivel else apagadas[i]
        salida.append((x, vy + 1, color))
        salida.append((x, vy + 2, color))
    return salida


def piloto(estado: str) -> list[tuple[int, int, str]]:
    """La joya del piloto: plena, o un punto más baja para el latido."""
    x0, y0, _, _ = PILOTO
    centro = {'pleno': 'coral', 'tenue': 'rojo-vivo'}[estado]
    aro = {'pleno': 'rojo-vivo', 'tenue': 'rojo-medio'}[estado]
    salida = [
        (x0, y0, 'laton-contorno'), (x0 + 1, y0, aro), (x0 + 2, y0, aro), (x0 + 3, y0, 'laton-contorno'),
        (x0, y0 + 1, aro), (x0 + 1, y0 + 1, 'bombilla' if estado == 'pleno' else centro),
        (x0 + 2, y0 + 1, centro), (x0 + 3, y0 + 1, aro),
        (x0, y0 + 2, aro), (x0 + 1, y0 + 2, centro), (x0 + 2, y0 + 2, centro), (x0 + 3, y0 + 2, aro),
        (x0, y0 + 3, 'laton-contorno'), (x0 + 1, y0 + 3, aro), (x0 + 2, y0 + 3, aro), (x0 + 3, y0 + 3, 'laton-contorno'),
    ]
    return salida


def guitarra(capa: Capa) -> None:
    """
    Una eléctrica en su soporte, apoyada a la izquierda del ampli.

    Silueta genérica a propósito —dos curvas y un corte—: las formas de las
    guitarras famosas son marcas registradas, y esto se va a cobrar.
    """
    cx = 61
    abajo = elipse(cx, 100.5, 11.5, 9.5)
    arriba = elipse(cx, 88.5, 8.5, 7)
    cuerpo = (abajo | arriba) - elipse(cx + 8, 83, 3.6, 3.8)
    contorno = borde(cuerpo)
    # Degradado de sol: rojo en el canto y ámbar hacia dentro, medido desde el
    # canto y no desde un centro —con un centro, la parte de arriba salía como un
    # bulto rojo aparte—. La mitad que da la espalda a la bombilla, un punto más
    # oscura.
    dentro = hondura(cuerpo)
    for x, y in cuerpo:
        if (x, y) in contorno:
            capa.px(x, y, 'negro')
            continue
        paso = dentro[(x, y)] - (1 if x > cx + 3 else 0)
        if paso <= 2:
            color = 'rojo-medio'
        elif paso <= 3:
            color = 'laton-sombra'
        elif paso <= 5:
            color = 'laton'
        else:
            color = 'laton-luz'
        capa.px(x, y, color)
    # El golpeador: una lágrima negra bajo las cuerdas, con su filo claro.
    golpeador = elipse(cx + 5, 102, 2.4, 3.6)
    for x, y in golpeador:
        if (x, y) in cuerpo and (x, y) not in contorno:
            capa.px(x, y, 'grafito-1')
    for x, y in borde(golpeador):
        if (x, y) in cuerpo and (x, y) not in contorno and x <= cx + 4:
            capa.px(x, y, 'grafito-4')
    # Las dos pastillas y el puente.
    for y in (91, 96):
        capa.rect(cx - 3, y, cx + 2, y + 1, 'negro')
        for x in range(cx - 3, cx + 3):
            capa.px(x, y, 'metal')
    capa.rect(cx - 2, 101, cx + 1, 101, 'acero')
    capa.rect(cx - 2, 102, cx + 1, 102, 'metal')
    # Los mandos.
    for x, y in ((cx + 8, 104), (cx + 9, 100)):
        capa.px(x, y, 'acero')
        capa.px(x, y + 1, 'metal')
    # El mástil, del cuerpo a la pala: claro del lado de la bombilla.
    for y in range(57, 83):
        capa.px(cx - 1, y, 'madera')
        capa.px(cx, y, 'madera-3')
        capa.px(cx + 1, y, 'madera-2')
        if y % 4 == 0:
            capa.px(cx, y, 'metal')
            capa.px(cx + 1, y, 'grafito-4')
    for y in range(57, 83):
        capa.px(cx - 2, y, 'negro')
        capa.px(cx + 2, y, 'negro')
    capa.rect(cx - 1, 56, cx + 1, 56, 'acero')  # la cejuela
    # La pala, con sus clavijas.
    capa.rect(cx - 2, 48, cx + 2, 55, 'madera')
    capa.rect(cx, 48, cx + 2, 55, 'madera-3')
    capa.marco(cx - 3, 47, cx + 3, 56, 'negro')
    capa.px(cx - 3, 47, None)
    capa.px(cx + 3, 47, None)
    for y in (49, 52, 55):
        capa.px(cx - 4, y, 'acero')
        capa.px(cx + 4, y, 'metal')
    # El soporte: la horquilla del mástil y las patas hasta el suelo.
    for x in range(cx - 3, cx + 4):
        capa.px(x, 72, 'grafito-4')
    capa.px(cx - 3, 71, 'metal')
    capa.px(cx + 3, 71, 'grafito-4')
    for (xa, ya, xb, yb) in ((cx - 6, 109, cx - 11, 113), (cx + 6, 109, cx + 11, 113), (cx, 110, cx, 114)):
        capa.linea(xa, ya, xb, yb, 'grafito-4')
    for x in (cx - 8, cx - 7, cx + 7, cx + 8):
        capa.px(x, 108, 'negro')  # las gomas de la cuna


def pedal(capa: Capa) -> None:
    """Un pedal verde en el suelo, con su conmutador y el piloto encendido."""
    x0, y0, x1, y1 = 74, 108, 85, 116
    capa.rect(x0, y0, x1, y1, 'verde')
    for x in range(x0, x1 + 1):
        capa.px(x, y0, 'verde-vivo')
        capa.px(x, y1 - 1, 'verde-apagado')
        capa.px(x, y1, 'verde-apagado')
    for y in range(y0, y1 - 1):
        capa.px(x0, y, 'verde-vivo' if y < y0 + 3 else 'verde')
    capa.marco(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 'negro')
    # Dos mandos, el piloto y el conmutador de pie.
    for kx in (x0 + 2, x1 - 2):
        capa.px(kx, y0 + 2, 'negro')
        capa.px(kx, y0 + 3, 'negro')
        capa.px(kx - 1, y0 + 2, 'grafito-4')
    capa.px((x0 + x1) // 2, y0 + 2, 'coral')
    capa.rect((x0 + x1) // 2 - 1, y0 + 5, (x0 + x1) // 2 + 1, y0 + 6, 'metal')
    capa.px((x0 + x1) // 2 - 1, y0 + 5, 'acero')


def cables(capa: Capa) -> None:
    """De la guitarra al pedal y del pedal al ampli, tirados por el suelo."""
    def cable(puntos: list[Punto]) -> None:
        for (xa, ya), (xb, yb) in zip(puntos, puntos[1:]):
            capa.linea(xa, ya, xb, yb, 'negro')
        for (xa, ya), (xb, yb) in zip(puntos, puntos[1:]):
            capa.linea(xa, ya - 1, xb, yb - 1, 'grafito-3')

    # De la guitarra (el jack del canto) al pedal, con una vuelta en el suelo.
    cable([(71, 106), (72, 110), (70, 115), (66, 118), (66, 121), (70, 122), (73, 118), (73, 113)])
    # Del pedal al ampli: cruza la alfombra y se mete por detrás de la pantalla.
    cable([(86, 113), (92, 116), (100, 118), (110, 118), (120, 117), (128, 116)])
    # Las clavijas.
    for x, y in ((71, 106), (86, 113), (73, 113)):
        capa.px(x, y, 'metal')


def microfono(capa: Capa) -> None:
    """Un micro en su pie, a la derecha: hace pareja con el platillo del otro lado."""
    x = 152
    # Las tres patas y su sombra.
    for xb in (x - 6, x + 6):
        capa.linea(x, 111, xb, 116, 'grafito-4')
    capa.linea(x, 111, x, 117, 'grafito-4')
    # El tubo: claro donde le llega algo de luz, y su canto oscuro a la derecha.
    for y in range(66, 111):
        capa.px(x, y, 'metal' if y < 92 else 'grafito-4')
        capa.px(x + 1, y, 'negro')
    capa.rect(x - 1, 91, x + 1, 92, 'metal')
    capa.px(x - 1, 91, 'acero')
    # La pinza y el micro: rejilla redonda de metal con su brillo, cuerpo negro.
    capa.rect(x - 1, 64, x + 1, 65, 'grafito-3')
    rejilla = elipse(x + 0.5, 59.5, 2.6, 3)
    for px_, py_ in rejilla:
        capa.px(px_, py_, 'metal' if (px_ + py_) % 2 else 'acero')
    for px_, py_ in borde(rejilla):
        capa.px(px_, py_, 'grafito-4' if px_ > x else 'acero')
    capa.px(x - 1, 58, 'bombilla')
    capa.rect(x - 1, 62, x + 1, 63, 'negro')
    capa.px(x - 1, 62, 'grafito-3')
    # Y su cable, que baja por el pie y se va por la derecha.
    capa.linea(x + 2, 64, x + 3, 80, 'negro')
    capa.linea(x + 3, 80, x + 2, 112, 'negro')
    capa.linea(x + 2, 112, x + 9, 117, 'negro')
    capa.linea(x + 9, 117, x + 30, 119, 'negro')


def dibujar_medio(mascota_estado: str = 'callado') -> Capa:
    capa = Capa()
    suelo(capa)
    alfombra(capa)
    sombra(capa, 82, 142, 114, 2)
    sombra(capa, 48, 74, 113, 2)
    sombra(capa, 72, 88, 117, 1)
    sombra(capa, 145, 159, 117, 1)
    cables(capa)
    guitarra(capa)
    pantalla(capa)
    cabezal(capa)
    pedal(capa)
    microfono(capa)
    capa.pegar(mascota(mascota_estado), MASCOTA[0], MASCOTA[1])
    return capa


# ---------------------------------------------------------------- la mascota

# Encima del cabezal, con las patillas apoyadas en el canto.
MASCOTA = (96, 26)


def cargar_mascota():
    ruta = RAIZ / 'arte/mascota/build.py'
    especificacion = importlib.util.spec_from_file_location('mascota_build', ruta)
    modulo = importlib.util.module_from_spec(especificacion)
    especificacion.loader.exec_module(modulo)
    return modulo


MASCOTA_BUILD = cargar_mascota()
# La paleta del tema oscuro, porque la escena va siempre sobre oscuro: en claro el
# contorno de grafito se perdería contra la pared.
for _nombre, _valor in MASCOTA_BUILD.PALETA['oscuro'].items():
    PALETA[f'mascota-{_nombre}'] = _valor


def mascota(estado: str) -> Capa:
    """El profesor en uno de sus estados, con los píxeles de su propio script."""
    todas = MASCOTA_BUILD.capas()
    capa = Capa(MASCOTA_BUILD.LADO, MASCOTA_BUILD.LADO)
    for (x, y), color in MASCOTA_BUILD.estado(todas, MASCOTA_BUILD.ESTADOS[estado]).items():
        if estado.startswith('atento') and color == 'cristal':
            color = 'cristal-encendido'
        capa.px(x, y, f'mascota-{color}')
    return capa


# ---------------------------------------------------------------- el frente

def platillo(capa: Capa) -> None:
    """
    Un platillo en su pie, entre la cámara y la guitarra.

    Va recortado por la izquierda casi siempre: es lo que dice que hay sala por
    ese lado y que la cámara está dentro, no delante de un decorado.
    """
    cx, cy = 37, 75
    disco = elipse(cx, cy, 16, 3.2)
    for x, y in disco:
        arriba = y + 0.5 < cy
        capa.px(x, y, 'laton' if arriba else 'laton-sombra')
    for x, y in borde(disco):
        if y + 0.5 >= cy:
            capa.px(x, y, 'laton-contorno')
    # El brillo mira a la bombilla, que queda arriba a la derecha.
    for x in range(cx + 3, cx + 12):
        capa.px(x, cy - 2, 'laton-luz')
    capa.px(cx + 7, cy - 3, 'bombilla')
    capa.px(cx + 8, cy - 2, 'bombilla')
    # La campana y la palomilla.
    capa.rect(cx - 2, cy - 3, cx + 2, cy - 2, 'laton')
    capa.px(cx + 1, cy - 3, 'laton-luz')
    capa.rect(cx - 1, cy - 5, cx + 1, cy - 4, 'metal')
    capa.px(cx - 1, cy - 5, 'acero')
    # El pie, hasta salir por abajo.
    for y in range(cy + 3, Y1):
        capa.px(cx, y, 'grafito-4')
        capa.px(cx + 1, y, 'negro')
    capa.rect(cx - 1, 112, cx + 2, 113, 'metal')


def rollo(capa: Capa) -> None:
    """
    Un cable enrollado en primer plano, a la derecha: tres vueltas y la clavija.

    Cada vuelta lleva su filo de luz arriba y su sombra abajo; sin eso, tres
    anillos negros sobre una tarima negra se leían como una mancha.
    """
    vueltas = ((158, 127, 11), (161, 125, 10), (157, 123, 9))
    for cx, cy, rx in vueltas:
        anillo = elipse(cx, cy, rx, 3.8) - elipse(cx, cy, rx - 1.8, 2.2)
        for x, y in anillo:
            capa.px(x, y, 'grafito-2')
        for x, y in anillo:
            if (x, y - 1) not in anillo and y < cy:
                capa.px(x, y, 'grafito-4')
            elif (x, y + 1) not in anillo and y > cy:
                capa.px(x, y, 'negro')
        capa.px(round(cx - rx * 0.5), round(cy - 3), 'metal')
    # La clavija, saliendo de la última vuelta hacia la cámara.
    capa.linea(147, 125, 143, 129, 'grafito-3')
    capa.rect(140, 129, 143, 131, 'metal')
    capa.px(140, 129, 'acero')
    capa.px(141, 129, 'acero')
    capa.px(139, 130, 'laton')
    capa.px(138, 130, 'laton-luz')


def dibujar_frente() -> Capa:
    capa = Capa()
    platillo(capa)
    rollo(capa)
    return capa


# ---------------------------------------------------------------- lo que se mueve

# Las dos notas, dibujadas a mano: con figuras tan pequeñas, una elipse de
# fórmula sale torcida. `#` es el color, `+` su luz.
CORCHEA = (
    '..+..',
    '..##.',
    '..#.#',
    '..#.#',
    '..#..',
    '.##..',
    '###..',
    '##...',
)
CORCHEAS = (
    '.....+##',
    '..+###.#',
    '..###..#',
    '..#....#',
    '..#..++#',
    '.##.###.',
    '###.##..',
    '##......',
)


def nota(corchea_doble: bool) -> Capa:
    """Una nota que sale del ampli: una corchea verde, o dos unidas en latón."""
    dibujo = CORCHEAS if corchea_doble else CORCHEA
    color, brillo = ('laton', 'laton-luz') if corchea_doble else ('verde-vivo', 'halo')
    capa = Capa(len(dibujo[0]), len(dibujo))
    for y, fila in enumerate(dibujo):
        for x, letra in enumerate(fila):
            if letra != '.':
                capa.px(x, y, brillo if letra == '+' else color)
    return capa


def secuencia_vumetro() -> list[int]:
    """
    Los niveles por los que pasa la aguja, en el orden en que salen.

    Escritos y no al azar, para que el dibujo sea el mismo cada vez que se
    genera. Se mueve como un bombo y una caja: sube de golpe y cae despacio.
    """
    return [4, 6, 5, 4, 3, 5, 7, 6, 4, 3, 2, 4, 6, 5, 3, 2]


def tiras() -> dict[str, list[Capa]]:
    """
    Cada cosa que se mueve, como una tira de fotogramas del tamaño de su caja.

    El fotograma 0 va vacío en todas: con la hoja descargada y la animación en su
    reposo, se ve lo que hay debajo, que es la escena quieta.
    """
    vacio = lambda ancho, alto: Capa(ancho, alto)  # noqa: E731

    def caja(x: int, y: int, ancho: int, alto: int, puntos: list[tuple[int, int, str]]) -> Capa:
        capa = Capa(ancho, alto)
        for px_, py_, color in puntos:
            capa.px(px_ - x, py_ - y, color)
        return capa

    vx, vy, vancho, valto = VUMETRO
    rx, ry, rancho, ralto = RENDIJAS
    pix, piy, pancho, palto = PILOTO
    nx, ny, nancho, nalto = NEON

    def neon_en(estado: str) -> Capa:
        # El neón sobre su trozo de pared: al apagarse tiene que quedar la pared,
        # no un agujero.
        fondo = pared()
        cartel(fondo)
        neon(fondo, estado)
        return fondo.recorte(nx, ny, nancho, nalto)

    lado = MASCOTA_BUILD.LADO
    return {
        'mascota': [vacio(lado, lado), mascota('parpadeo'), mascota('atento'), mascota('atento-2')],
        'vumetro': [vacio(vancho, valto)] + [caja(vx, vy, vancho, valto, vumetro(n)) for n in secuencia_vumetro()],
        'valvulas': [vacio(rancho, ralto)] + [caja(rx, ry, rancho, ralto, rendijas(e)) for e in ('tenue', 'brillo')],
        'piloto': [vacio(pancho, palto), caja(pix, piy, pancho, palto, piloto('tenue'))],
        'neon': [vacio(nancho, nalto), neon_en('apagado'), neon_en('tenue')],
        'corchea': [nota(False)],
        'corcheas': [nota(True)],
    }


# Dónde va cada tira en la escena, en píxeles del lienzo, y en qué capa. Las
# notas nacen encima del cabezal, una a cada lado del profesor, y suben por la
# pared: a la derecha queda el hueco hasta el neón y a la izquierda el de la
# guitarra.
SITIOS = {
    'mascota': ('medio', MASCOTA[0], MASCOTA[1]),
    'vumetro': ('medio', VUMETRO[0], VUMETRO[1]),
    'valvulas': ('medio', RENDIJAS[0], RENDIJAS[1]),
    'piloto': ('medio', PILOTO[0], PILOTO[1]),
    'neon': ('fondo', NEON[0], NEON[1]),
    'corchea': ('medio', 129, 50),
    'corcheas': ('medio', 86, 49),
}


def hoja(todas: dict[str, list[Capa]]) -> tuple[Capa, dict[str, dict[str, int]]]:
    """Las tiras una debajo de otra, cada una con sus fotogramas en fila."""
    ancho = max(len(cuadros) * cuadros[0].ancho for cuadros in todas.values())
    alto = sum(cuadros[0].alto for cuadros in todas.values())
    salida = Capa(ancho, alto)
    medidas: dict[str, dict[str, int]] = {}
    y = 0
    for nombre, cuadros in todas.items():
        for indice, cuadro in enumerate(cuadros):
            salida.pegar(cuadro, indice * cuadro.ancho, y)
        capa, sx, sy = SITIOS[nombre]
        medidas[nombre] = {
            # En el módulo, en coordenadas del lienzo: es lo que mide la página.
            'x': sx + MARGEN[0],
            'y': sy + MARGEN[1],
            'ancho': cuadros[0].ancho,
            'alto': cuadros[0].alto,
            'fila': y,
            'marcos': len(cuadros),
        }
        y += cuadros[0].alto
    return salida, medidas


# ---------------------------------------------------------------- salida

def guardar_png(capa: Capa, ruta: Path) -> int:
    """
    Con paleta y sin canal alfa a medias: un índice transparente y el resto opaco.

    Es lo que hace que una capa entera pese uno o dos kilobytes. Un PNG de
    color verdadero con alfa guarda cuatro bytes por punto aunque haya treinta
    colores.
    """
    from PIL import Image

    usados = sorted({c for fila in capa.p for c in fila if c is not None})
    paleta = [(0, 0, 0)] + [tuple(int(PALETA[c][i:i + 2], 16) for i in (1, 3, 5)) for c in usados]
    indice = {c: i + 1 for i, c in enumerate(usados)}
    imagen = Image.new('P', (capa.ancho, capa.alto), 0)
    imagen.putdata([indice[c] if c is not None else 0 for fila in capa.p for c in fila])
    imagen.putpalette([v for color in paleta for v in color])
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tiene_hueco = any(c is None for fila in capa.p for c in fila)
    if tiene_hueco:
        imagen.save(ruta, optimize=True, transparency=0)
    else:
        imagen.save(ruta, optimize=True)
    return ruta.stat().st_size


CABECERA = """\
/*
 * GENERADO por arte/portada/build.py. No se edita a mano: se cambia el script y
 * se vuelve a ejecutar (`python3 arte/portada/build.py`).
 *
 * Las medidas de la escena de la portada en píxeles del dibujo, no de pantalla:
 * la hoja de estilos las multiplica por `--px`, que es el tamaño entero al que se
 * pinta cada píxel.
 */
"""


def escribir_ts(medidas: dict[str, dict[str, int]], hoja_capa: Capa) -> None:
    x, y, ancho, alto = SEGURO
    x, y = x + MARGEN[0], y + MARGEN[1]
    lineas = [CABECERA]
    lineas.append('/** El lienzo entero: lo que se ve y la pared de sobra alrededor. */')
    lineas.append(f'export const LIENZO = {{ ancho: {LIENZO_ANCHO}, alto: {LIENZO_ALTO} }} as const;')
    lineas.append('')
    lineas.append('/** Lo que se ve en la caja más pequeña de verdad, centrado en el lienzo. */')
    lineas.append(f'export const SEGURO = {{ x: {x}, y: {y}, ancho: {ancho}, alto: {alto} }} as const;')
    lineas.append('')
    lineas.append('/** La hoja de lo que se mueve (`_escena/vida.png`). */')
    lineas.append(f'export const HOJA = {{ ancho: {hoja_capa.ancho}, alto: {hoja_capa.alto} }} as const;')
    lineas.append('')
    lineas.append('export type CapaDeLaEscena = \'fondo\' | \'medio\' | \'frente\';')
    lineas.append('')
    lineas.append('export interface Tira {')
    lineas.append('  /** Dónde se pinta, en el lienzo. */')
    lineas.append('  readonly x: number;')
    lineas.append('  readonly y: number;')
    lineas.append('  readonly ancho: number;')
    lineas.append('  readonly alto: number;')
    lineas.append('  /** En qué fila de la hoja empieza, y cuántos fotogramas tiene. */')
    lineas.append('  readonly fila: number;')
    lineas.append('  readonly marcos: number;')
    lineas.append('  readonly capa: CapaDeLaEscena;')
    lineas.append('}')
    lineas.append('')
    lineas.append('export const TIRAS = {')
    for nombre, m in medidas.items():
        capa = SITIOS[nombre][0]
        campos = ', '.join(f'{k}: {v}' for k, v in m.items())
        lineas.append(f"  {nombre}: {{ {campos}, capa: '{capa}' }},")
    lineas.append('} as const satisfies Record<string, Tira>;')
    lineas.append('')
    MODULO.write_text('\n'.join(lineas), encoding='utf-8')
    subprocess.run(['pnpm', 'exec', 'prettier', '--write', str(MODULO)], cwd=RAIZ, check=True,
                   stdout=subprocess.DEVNULL)


def muestra(capas: dict[str, Capa], hoja_capa: Capa, todas: dict[str, list[Capa]], carpeta: Path) -> None:
    """La escena compuesta a 4×, la zona segura marcada aparte, y un GIF de la vida."""
    from PIL import Image, ImageDraw

    carpeta.mkdir(parents=True, exist_ok=True)
    compuesta = Image.new('RGBA', (LIENZO_ANCHO, LIENZO_ALTO), (0, 0, 0, 255))
    for nombre in ('fondo', 'medio', 'frente'):
        compuesta.alpha_composite(capas[nombre].imagen())
    escala = 4
    compuesta.resize((LIENZO_ANCHO * escala, LIENZO_ALTO * escala), Image.NEAREST).save(carpeta / 'escena-4x.png')
    x, y, ancho, alto = SEGURO
    x, y = x + MARGEN[0], y + MARGEN[1]
    segura = compuesta.crop((x - 3, y - 2, x + ancho + 3, y + alto + 2))
    segura.resize((segura.width * 4, segura.height * 4), Image.NEAREST).save(carpeta / 'segura-4x.png')
    # Lo que enseña la caja de verdad en tres anchos: el escritorio a 3×, la
    # tableta a 4× y un teléfono de 390 a 2×.
    for nombre_encuadre, (ancho_caja, alto_caja, por) in {
        'escritorio': (504, 403, 3), 'tableta': (656, 525, 4), 'telefono': (309, 231, 2),
    }.items():
        visto_ancho, visto_alto = ancho_caja // por, alto_caja // por
        izquierda = (LIENZO_ANCHO - visto_ancho) // 2
        arriba = (LIENZO_ALTO - visto_alto) // 2
        encuadre = compuesta.crop((izquierda, arriba, izquierda + visto_ancho, arriba + visto_alto))
        encuadre.resize((visto_ancho * por, visto_alto * por), Image.NEAREST).save(
            carpeta / f'encuadre-{nombre_encuadre}.png'
        )
    marcada = compuesta.resize((LIENZO_ANCHO * 2, LIENZO_ALTO * 2), Image.NEAREST)
    ImageDraw.Draw(marcada).rectangle([x * 2, y * 2, (x + ancho) * 2 - 1, (y + alto) * 2 - 1], outline=(255, 0, 255))
    marcada.save(carpeta / 'escena-marcada-2x.png')
    for nombre, capa in capas.items():
        capa.imagen().resize((LIENZO_ANCHO * 2, LIENZO_ALTO * 2), Image.NEAREST).save(carpeta / f'capa-{nombre}-2x.png')
    fondo_hoja = Image.new('RGBA', (hoja_capa.ancho, hoja_capa.alto), (40, 0, 40, 255))
    fondo_hoja.alpha_composite(hoja_capa.imagen())
    fondo_hoja.resize((hoja_capa.ancho * 6, hoja_capa.alto * 6), Image.NEAREST).save(carpeta / 'hoja-6x.png')
    # Un GIF que pone cada tira en su sitio, fotograma a fotograma: no es la
    # cadencia de la página, es para ver que cada cuadro cae donde debe.
    cuadros = []
    for paso in range(16):
        imagen = compuesta.copy()
        for nombre, tira in todas.items():
            if nombre in ('corchea', 'corcheas'):
                continue
            capa_nombre, sx, sy = SITIOS[nombre]
            cuadro = tira[paso % len(tira)]
            imagen.alpha_composite(cuadro.imagen(), (sx + MARGEN[0], sy + MARGEN[1]))
        x0, y0 = x, y
        cuadros.append(imagen.crop((x0, y0, x0 + ancho, y0 + alto)).resize((ancho * 4, alto * 4), Image.NEAREST))
    cuadros[0].save(carpeta / 'vida.gif', save_all=True, append_images=cuadros[1:], duration=250, loop=0)


def main() -> None:
    argumentos = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    argumentos.add_argument('--muestra', type=Path, help='carpeta donde dejar las láminas')
    argumentos.add_argument('--sin-salida', action='store_true', help='no reescribir imágenes ni módulo')
    opciones = argumentos.parse_args()
    capas = {'fondo': dibujar_fondo(), 'medio': dibujar_medio(), 'frente': dibujar_frente()}
    todas = tiras()
    hoja_capa, medidas = hoja(todas)
    if not opciones.sin_salida:
        total = 0
        for nombre, capa in capas.items():
            total += guardar_png(capa, CARPETA / f'{nombre}.png')
        total += guardar_png(hoja_capa, CARPETA / 'vida.png')
        escribir_ts(medidas, hoja_capa)
        print(f'escena: {total} bytes en {CARPETA.relative_to(RAIZ)}')
    if opciones.muestra:
        muestra(capas, hoja_capa, todas, opciones.muestra)


if __name__ == '__main__':
    main()
