'use client';

import { accidentalForScale, SCALES, scaleNotes, noteName } from '@core/music';
import { useAcordeElegido } from '@state/acorde-elegido';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Fretboard } from './Fretboard';

/**
 * Lo que dice el mástil, en una línea, **para la cabecera del área**.
 *
 * Vivía encima del dibujo, en su propia fila. Ahí costaba 45 píxeles entre la
 * fila, su margen y el relleno del área, y esos 45 son justo los que le
 * faltaban al dibujo para llenar el ancho de un monitor de 1440: el tope mordía
 * y se quedaba en el 91 %. La cabecera ya estaba ahí y estaba vacía a la
 * derecha.
 *
 * Va en `text-sm`, que es el tamaño que tenía cuando vivía encima del dibujo.
 * Bajarlo a `text-xs` al subirla aquí **la dejó sin leerse**, y es lo que dice
 * qué notas son y qué papel hace la escala: en la cabecera el tamaño no cuesta
 * alto, porque mide veintiocho píxeles fijos.
 *
 * El ancho máximo existe porque el sitio de los mandos no encoge: sin él, la
 * frase empujaba al botón de cerrar fuera de la cabecera. **Dieciséis rem son
 * lo que ocupan el nombre del área y los dos botones**, así que con el tamaño
 * bueno la frase entra entera desde 1280 y no llega a truncarse: un texto
 * cortado es contenido que no se alcanza, y lo canta la sonda de medidas.
 *
 * Y por debajo de 1280 no sale: la cabecera no da para una frase y un botón, y
 * lo truncado es contenido que no se alcanza —lo canta la sonda de medidas—.
 * Ahí abajo el área es una pestaña y ya lleva su nombre.
 */
export function RotulosDelMastil() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const delMontaje = useAcordeElegido();
  const delCamino = useSessionStore((state) => state.path.at(-1) ?? null);
  const elegido = delMontaje ?? delCamino;

  if (activeKey === null) return null;

  return (
    <p className="hidden max-w-[calc(100vw-16rem)] truncate text-sm xl:block">
      {SCALES[scaleId].name} de{' '}
      {noteName(activeKey.tonic, accidentalForScale(activeKey.tonic, scaleId))}:{' '}
      <span className="text-text font-mono">
        {scaleNotes(activeKey.tonic, scaleId)
          .map((pitchClass) => noteName(pitchClass, accidentalForScale(activeKey.tonic, scaleId)))
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
  );
}

/** Escala que se propone según el modo detectado, si no se ha elegido otra. */
export function FretboardPanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
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

              Las rem del alto son lo que hay que dejarle a todo lo demás: la
              barra de navegación (61), la de herramientas —57, u 85 cuando se
              parte en dos filas por debajo de 1280—, el suelo al que baja el
              arreglo mientras cede (128) más los 44 de la tira de un área
              plegada, la barra de abajo (61) y la cabecera de esta área (37).
              Medido, no estimado.

              En estrecho no: ahí el área es una pestaña, el alto lo pone el
              dibujo con su proporción natural y `aspect-[712/198]` la escribe
              —Tailwind lee las clases del fichero, así que no puede salir de
              una constante; hay un test que avisa si dejan de coincidir—. */}
          <div className="aspect-[712/198] w-full shrink-0 lg:aspect-auto lg:h-[calc(100dvh-26rem)] xl:h-[calc(100dvh-24.25rem)]">
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForScale(activeKey.tonic, scaleId)}
              scaleId={scaleId}
              /* v8 ignore next -- con señal siempre hay lectura: las dos las pone el mismo `setPitch` */
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
              chordNotes={elegido?.notes}
            />
          </div>
        </>
      )}
    </div>
  );
}
