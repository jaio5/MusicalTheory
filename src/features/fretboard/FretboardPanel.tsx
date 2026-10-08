'use client';

import { accidentalForScale, SCALES, scaleNotes, noteName } from '@core/music';
import { useAcordeElegido } from '@state/acorde-elegido';
import { selectActiveKey, selectEscala, useSessionStore } from '@state/session-store';

import { EscalaDelMastil } from './EscalaDelMastil';
import { Fretboard, PROPORCION } from './Fretboard';

/**
 * Lo alto que va el dibujo en la hoja de un teléfono, en rem.
 *
 * Dieciocho rem son 288 px: el dibujo mide 198 unidades, así que sale a 1,45
 * aumentos, con dianas de 26 px y letras de 13 —por encima de los 12 que
 * `docs/ESTILO.md` pone de mínimo, también dentro de un SVG—. A lo ancho son
 * 1036 px, que no caben en ningún teléfono: se arrastran, y lo que se recorta
 * son trastes y no letras.
 */
const ALTO_DE_LA_HOJA_REM = 18;

/**
 * La cabecera del área: **la escala, que se cambia aquí, y lo que dice el
 * mástil**, en una línea.
 *
 * La frase vivía encima del dibujo, en su propia fila. Ahí costaba 45 píxeles
 * entre la fila, su margen y el relleno del área, y esos 45 son justo los que le
 * faltaban al dibujo para llenar el ancho de un monitor de 1440: el tope mordía
 * y se quedaba en el 91 %. La cabecera ya estaba ahí y estaba vacía a la
 * derecha. Por lo mismo va aquí el selector de escala (`EscalaDelMastil`): en la
 * cabecera no cuesta alto.
 *
 * **El selector sale en todos los anchos y la frase solo desde 1280.** El
 * selector ya dice el nombre de la escala, así que la frase empieza donde él
 * acaba —«de C: C · Eb · F · G · Bb»— y se lee seguida: «Pentatónica menor de
 * C…». Por debajo de 1280 la cabecera no da para una frase y un mando, y lo
 * truncado es contenido que no se alcanza —lo canta la sonda de medidas—.
 *
 * Va en `text-sm`, que es el tamaño que tenía cuando vivía encima del dibujo.
 * Bajarlo a `text-xs` al subirla aquí **la dejó sin leerse**, y es lo que dice
 * qué notas son y qué papel hace la escala.
 *
 * El ancho máximo existe porque el sitio de los mandos no encoge: sin él, la
 * frase empujaba al botón de cerrar fuera de la cabecera. **Veintiséis rem son
 * lo que ocupan el nombre del área, el selector con sus flechas y el botón de
 * cerrar, con un rem de holgura**: medidos, 399 px. Con eso le quedan 864 a la
 * frase a 1280, y la más larga que sale —siete notas con alteración y un acorde
 * elegido, «de F#: F# · G# · A# · B · C# · D# · E# · Rellenas, las notas de
 * C#7sus4…»— mide 810: entra entera.
 */
export function RotulosDelMastil() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore(selectEscala);
  const delMontaje = useAcordeElegido();
  const delCamino = useSessionStore((state) => state.path.at(-1) ?? null);
  const elegido = delMontaje ?? delCamino;

  // Sin tonalidad el mástil no dibuja ninguna escala, y un selector que no
  // cambia nada a la vista es peor que no tenerlo: lo que hay que hacer primero
  // es elegir la tonalidad, y el panel lo dice.
  if (activeKey === null) return null;

  const alteracion = accidentalForScale(activeKey.tonic, scaleId);

  return (
    <div className="flex min-w-0 items-stretch gap-2 self-stretch">
      <EscalaDelMastil />
      <p className="hidden max-w-[calc(100vw-26rem)] self-center truncate xl:block">
        de {noteName(activeKey.tonic, alteracion)}:{' '}
        <span className="text-text font-mono">
          {scaleNotes(activeKey.tonic, scaleId)
            .map((pitchClass) => noteName(pitchClass, alteracion))
            .join(' · ')}
        </span>
        {/* Con un acorde elegido, lo que dice el mástil ya no es la escala: es qué
            notas de la escala caen de pie sobre ese acorde. Se dice, porque el
            relleno solo no lo explica. */}
        <span className="text-text-muted">
          {elegido === null
            ? ` · ${SCALES[scaleId].character}`
            : ` · Rellenas, las notas de ${elegido.symbol}: caen de pie. Las huecas entran de paso.`}
        </span>
      </p>
    </div>
  );
}

/**
 * Escala que se propone según el modo detectado, si no se ha elegido otra.
 *
 * Con `hoja`, el dibujo va a tamaño de lectura y se arrastra de lado: es como
 * se pinta en un teléfono, donde llenar el ancho lo dejaba en 102 px de alto.
 */
export function FretboardPanel({ hoja = false }: { readonly hoja?: boolean } = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore(selectEscala);
  /**
   * La nota que suena, como número y no como lectura.
   *
   * La lectura es nueva cada cincuenta milisegundos, y el mástil entero —más de
   * cien nodos de SVG— se repintaba a ese ritmo aunque la nota fuera la misma.
   * El número solo cambia cuando cambia la nota, que es lo único que dibuja.
   */
  const soundingMidi = useSessionStore(
    (state) =>
      /* v8 ignore start -- con señal siempre hay lectura: las dos las pone el mismo `setPitch` */
      state.hasSignal ? (state.reading?.midi ?? null) : null,
    /* v8 ignore stop */
  );
  /**
   * El acorde que marcar en el mástil: **el bloque que tienes elegido**.
   *
   * Y no el que se está oyendo: el mástil se mira **antes** de tocar, para ver
   * dónde caen las notas del acorde que se va a hacer.
   *
   * Era el último del camino, que es la segunda canción paralela a la de verdad
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)):
   * elegías un acorde de tu canción y el mástil seguía marcando otro. El camino
   * queda de respaldo mientras haya algo que solo sepa llenarlo a él.
   */
  const delMontaje = useAcordeElegido();
  const delCamino = useSessionStore((state) => state.path.at(-1) ?? null);
  const elegido = delMontaje ?? delCamino;

  return (
    // `grow`, para que el hueco del área llegue hasta el dibujo: el mástil se
    // acota con `max-h-full`, y un porcentaje no resuelve contra un padre de
    // alto automático —se quedaba en catorce píxeles—.
    <div className="flex min-h-0 grow flex-col">
      {activeKey === null ? (
        <p className="text-text-muted mt-6 shrink-0">
          Toca unas notas sueltas o elige una tonalidad arriba, y aquí sale la escala sobre el
          mástil.
        </p>
      ) : (
        <>
          {/* **El hueco pide el alto que llena el ancho, y nunca más del que
              hay.** Antes el hueco se quedaba con lo que sobrara y el dibujo se
              encogía dentro: a mil cuatrocientos de ancho se pintaba a
              seiscientos cincuenta, centrado entre dos franjas muertas.

              El ancho lo pone la proporción, que no hay que adivinarlo; el tope
              va en unidades de ventana porque **un porcentaje no resuelve
              contra un padre de alto automático**, y el área ya no lo tiene.
              Con `max-h-full` el tope no topaba nada, el dibujo se imponía y
              empujaba al arreglo por debajo de su suelo hasta cortarle lo de
              dentro: aparecían recortes a 1280 y a 1024 donde no los había.

              `shrink-0` y no `shrink`: cediendo, el flex repartía el recorte
              entre el mástil y la canción y el dibujo se quedaba en el 91 % del
              ancho teniendo tope de sobra. El que manda es el tope, que sabe
              cuánto hay que dejarle a la canción; el flex no lo sabe.

              Cuando el tope muerde, el ancho se queda y el alto no: el dibujo
              vuelve a encogerse centrado, que es lo menos malo cuando no hay
              alto que darle. */}
          {/* **El hueco le da el alto y el mástil se estira a lo ancho.** Antes
              llevaba la proporción del dibujo, y en una ventana baja eso lo
              dejaba en un cuadrado centrado con dos franjas muertas a los
              lados: el alto que sobraba mandaba sobre el ancho que había.
              Ahora el dibujo se mide su caja y reparte los trastes por ella
              ([adr/0039](../../../docs/adr/0039-el-mastil-se-estira-a-lo-ancho.md)).

              Las rem del tope se cuentan más abajo, donde está el tope.

              En estrecho no: ahí el área es una pestaña, el alto lo pone el
              dibujo con su proporción natural y `aspect-[712/198]` la escribe
              —Tailwind lee las clases del fichero, así que no puede salir de
              una constante; hay un test que avisa si dejan de coincidir—.

              **Y esa proporción manda también en ancho: el hueco solo pone el
              techo.** Con el alto fijo, en una ventana alta la caja se quedaba
              más alta de lo que el dibujo puede usar —el dibujo llena el ancho y
              deja bandas arriba y abajo— y sobraban 149 px a 1440×900 y 206 a
              1920×1080, con el arreglo en su suelo al lado. Con `max-h` el
              dibujo mide exactamente lo mismo y esos píxeles vuelven a la
              canción ([adr/0046](../../../docs/adr/0046-el-mastil-solo-ocupa-lo-que-dibuja.md)). */}
          {/* **Las rem del tope son lo que hay que dejarle a todo lo demás**:
              la barra de navegación (61), la de la cabecera (57), la de abajo
              (61), la cabecera de esta área (44), la de «a dónde ir» o su tira
              (44) y el suelo del arreglo: 224 por debajo de 1280 y 176 por
              encima (`ComposeScreen`). Medido: 491 y 443, que son 31 y 28 rem.
              Antes descontaba 26 y 24,25 sin contar el suelo entero ni el cajón
              de abajo, y con las cinco áreas abiertas el arreglo se quedaba en
              128 px a 1440×900.

              **Y tiene suelo, catorce rem**: en una ventana baja la resta deja
              al mástil en 104 px (1024×600, todo abierto) y sus letras en 5,8.
              Con 224 px las notas pasan de los 12 de la casa; el que cede ahí es
              el arreglo (`ComposeScreen`, por debajo de 700 de alto). */}
          {hoja ? (
            <div className="hay-mas-al-lado -mx-3 overflow-x-auto px-3">
              <div
                className="shrink-0"
                style={{
                  height: `${ALTO_DE_LA_HOJA_REM}rem`,
                  width: `${Math.round(PROPORCION * ALTO_DE_LA_HOJA_REM * 100) / 100}rem`,
                }}
              >
                <Fretboard
                  tonic={activeKey.tonic}
                  accidental={accidentalForScale(activeKey.tonic, scaleId)}
                  scaleId={scaleId}
                  soundingMidi={soundingMidi}
                  chordNotes={elegido?.notes}
                />
              </div>
            </div>
          ) : (
            <div className="aspect-[712/198] w-full shrink-0 lg:max-h-[max(14rem,calc(100dvh-31rem))] xl:max-h-[max(14rem,calc(100dvh-28rem))]">
              <Fretboard
                tonic={activeKey.tonic}
                accidental={accidentalForScale(activeKey.tonic, scaleId)}
                scaleId={scaleId}
                soundingMidi={soundingMidi}
                chordNotes={elegido?.notes}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
