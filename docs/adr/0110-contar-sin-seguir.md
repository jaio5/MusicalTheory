# ADR 0110 — Contar sin seguir: la analítica es nuestra, y lo que se guarda en el aparato pide permiso

Fecha: 2026-10-07 · Estado: aceptada

## Contexto

Para publicar sin cobrar hace falta saber **si alguien vuelve**: si quien prueba la
aplicación la abre otro día, a la semana, al mes. Hasta hoy no se contaba nada.

Las condiciones de partida: nada de terceros (ni PostHog, ni Google, ni un píxel de
nadie), nada de cookies, ni audio ni texto libre en la base (regla 4), y que una
copia sin base de datos siga funcionando entera.

Lo que se descubrió al escribirlo es que **«sin cookies» no basta para no pedir
permiso**. El art. 22.2 de la LSSI-CE habla de «dispositivos de almacenamiento y
recuperación de datos» en el equipo del usuario, no de cookies: un identificador en
`localStorage` es lo mismo a efectos legales. Y la guía de cookies de la AEPD
(actualizada en 2023) dice de las de medición de audiencia propias que es poco
probable que supongan un riesgo, **pero que no están exentas del consentimiento**:
la exención que aplica la CNIL en Francia aquí no está. Para saber si alguien vuelve
hay que reconocerle, y para reconocerle hay que guardar algo en su aparato o tener
algo del servidor que ya le reconozca.

## Decisión

Dos mitades, en tres tablas propias (`metricas_conteo`, `metricas_visitantes`,
`metricas_dias`), con `server/metricas.ts` y la ruta `/api/metricas`:

1. **Lo sumado, para todo el mundo y sin permiso.** Una fila por día, evento y ruta
   con cuántas veces pasó: visitas a cada pantalla, unidades terminadas, canciones
   guardadas, tomas grabadas. Sin nadie dentro —ni seudónimo— y sin nada guardado
   en el aparato: el navegador manda un `sendBeacon` con el nombre del evento y,
   en las visitas, la ruta. Las rutas variables se guardan con el hueco
   (`/aprender/[unidad]`) y lo que no se reconoce es `otra`
   (`core/analytics.ts`). No hay ningún dato personal, así que no hay tratamiento
   que justificar.
2. **Quién vuelve, solo con algo que ya le reconozca.**
   - **Con cuenta**, el servidor pone un **seudónimo de la cuenta** —un HMAC con
     `AUTH_SECRET`, no el identificador— y apunta los días en que estuvo. No se
     guarda nada nuevo en el aparato: la sesión ya está. Base: interés legítimo
     (RGPD 6.1.f), con oposición por correo, y se borra al borrar la cuenta.
   - **Sin cuenta, solo si dice que sí**: entonces el navegador guarda un UUID al
     azar y lo manda con cada evento; el servidor guarda su HMAC. Decir que no lo
     borra. **Por defecto, no**, y se decide en `/privacidad` (`ContarVueltas`), sin
     ventana que tape la pantalla.
   - `primera-vez` y `vuelve-otro-dia` no los manda nadie: los deduce el servidor de
     si el seudónimo ya existía y si ese día ya estaba.
3. **`Do Not Track` y `Sec-GPC` son no contar nada**, ni sumado, en el navegador y
   otra vez en el servidor.
4. **Ninguna dirección IP**: el tope de la ruta (sesenta por minuto) cuenta con la
   huella de la dirección, no con ella.
5. **Trece meses** y se borran los días; lo sumado se queda, que no es de nadie.
6. **Se lee con `GET /api/metricas`** y `Authorization: Bearer $METRICAS_CLAVE`. Sin
   esa variable la ruta no existe. Devuelve la retención a 7 días (volvió entre el
   día 7 y el 13), a 30 (entre el 30 y el 36), quién vuelve **cada una** de las
   cuatro últimas semanas y lo sumado del último mes, siempre con los dos números
   —cuántos podían volver y cuántos volvieron— y no un tanto por ciento suelto.

Lo que se cuenta y dónde: la visita en `app/ContarVisitas.tsx` (layout raíz, así
que la portada también); la unidad terminada en `state/learn-progress.ts`, al
guardar el avance; la toma al arrancar de verdad, en
`state/use-tocar-y-apuntar.ts`; la canción en el `POST` de `/api/canciones`.

## Descartadas

- **Un identificador en `localStorage` sin preguntar**, que es lo que pedía el
  encargo. Daría la retención de todo el mundo, y sería saltarse el art. 22.2 tal
  como lo lee la AEPD. Llamarlo «sin cookies» no cambia lo que es.
- **Una huella de IP y navegador**, que no guarda nada en el aparato. La AEPD y el
  CEPD tratan la huella digital igual que una cookie, y además es dato personal
  sin permiso de nadie: peor en las dos cosas.
- **Un aviso de consentimiento que tape la pantalla al entrar.** Daría más gente
  contada sin cuenta. Se descarta por ahora: la portada y la primera visita ya
  tienen su recorrido, y una ventana más al entrar es lo que hace que la gente se
  vaya. Si la retención sin cuenta resulta imprescindible, es lo primero que
  reconsiderar —con «sí» y «no» igual de grandes—.
- **PostHog, Plausible o Matomo alojados por nosotros.** Resuelven la parte de
  pintar gráficas, y traen un servicio más que desplegar, mantener y explicar en
  la política. Las preguntas son tres y caben en una ruta.
- **Una fila por evento**, con el seudónimo dentro. Permitiría cualquier pregunta
  futura, y es justo el registro de actividad por persona que no hace falta tener.
- **Contar la unidad terminada en `learn/`**, donde se termina. Es lo exacto, pero
  esa capa estaba en otras manos; desde el guardado se cuenta solo si entra **una**
  unidad nueva **hoy**, que deja fuera la fusión del avance al entrar. Lo que no
  distingue es una fusión que traiga justo una unidad hecha hoy en otro aparato.

## Consecuencias

- **Sin cuenta y sin decir que sí, nadie «vuelve»**: se ve cuánto se usa cada
  pantalla, no quién repite. La retención que sale es la de quien tiene cuenta, más
  quien haya dicho que sí. Es un sesgo, y la política de privacidad lo explica.
- **Cambiar `AUTH_SECRET` reinicia la retención**: todos los seudónimos cambian.
- Leer se cuenta en SQL desde el [ADR 0113](./0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md):
  traerlo a memoria crecía con cada visitante. La definición sigue en `core/`,
  probada en `core/analytics.test.ts`, y un test compara las dos. El mismo ADR pone
  tope a los visitantes nuevos por dirección y marca lo que declara el navegador.
- La poda va cada doscientos eventos, como la del límite de frecuencia: no hay
  tarea programada.
- Sin base de datos la ruta contesta 204 y no hace nada.
