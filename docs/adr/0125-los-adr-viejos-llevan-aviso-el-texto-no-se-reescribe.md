# ADR 0125 — Los ADR viejos llevan aviso, y el texto no se reescribe

Fecha: 2026-10-08 · Estado: aceptada · Aclara: la frase de
[ADR 0027](./0027-grafito-y-ambar.md) según la cual los ADR viejos «no se tocan»

## Contexto

Dos cosas escritas en esta casa se contradecían. [ADR 0027](./0027-grafito-y-ambar.md)
dice que los ADR 0010, 0024 y 0025 **no** se tocan, «porque un ADR es lo que se
decidió entonces, y reescribirlos sería borrar por qué se llega hasta aquí». Y la
práctica, desde mucho antes, era poner arriba de un ADR superado una línea del tipo
«Sustituido en parte por…» (0006, 0015, 0030, 0044, 0065, 0086…).

Una auditoría de la documentación encontró lo que pasa cuando solo manda la primera:
más de treinta ADR seguían diciendo en presente cosas que otro posterior había
cambiado —los cupos de 0008, los tres planes de 0006, los 21 pasos del recorrido de
0094, la paleta de 0010—, y quien llegaba por ellos salía creyéndolas. Y lo que pasa
cuando solo manda la segunda: sin una regla, cada aviso se escribía como cada cual y
nadie sabía hasta dónde se podía retocar.

## Decisión

**El texto de un ADR no se reescribe; se le pone aviso.**

1. **Lo que se decidió, y por qué, se queda como se escribió.** No se corrige una
   cifra en el cuerpo, no se borra una alternativa descartada ni se cambia el
   contexto para que parezca que se sabía lo que luego se supo. Ahí vive el
   recorrido que lleva hasta hoy.
2. **Arriba, tras el título, va una línea de aviso** en un bloque `>` que dice qué
   ADR posterior lo cambia y **qué parte**: «Sustituido en parte por…»,
   «Corregido en parte por…», «Ampliado por…» o, si es una cifra, «Cifras de hoy».
   Lo vigente en cifras se remite al documento que es su única fuente
   (`CUENTAS-Y-PLANES.md` para cupos y precios).
3. **El estado de la cabecera dice la verdad**: si ya no rige, «retirada» o
   «sustituida»; si rige con matices, «aceptada» con el aviso encima. «A prueba» y
   «en revisión» no se dejan puestos cuando el asunto se cerró.
4. **El ADR nuevo lo dice también** en su cabecera (`Corrige:`, `Completa:`,
   `Sustituye en parte a:`), de modo que el vínculo se lea desde los dos lados.
5. **Lo único que se edita dentro del cuerpo** son los enlaces —a un fichero
   renombrado, a una ruta que se movió— y las rutas de ficheros que cita, porque
   un enlace roto no conserva ninguna historia. Se hizo con `main-thread-cost`
   (ahora `.reloj.test.ts`) y con el enlace de 0114 a 0115.

## Consecuencias

- Un lector que abre un ADR viejo sabe en la primera línea si sigue en pie, y a
  dónde ir si no.
- `documentacion.test.ts` vigila que los enlaces entre documentos no estén rotos,
  que es lo único del cuerpo que se retoca.
- Un ADR que se quedó sin aviso no es una contradicción de la política, es una
  tarea pendiente: añadírselo no pide permiso.

## Alternativas descartadas

**Reescribir los ADR para que digan la verdad de hoy.** Es lo que pide la regla
general de la casa para los demás documentos, y aquí no vale: un ADR sin su
alternativa descartada ni su contexto original deja de ser una decisión y pasa a ser
una descripción, que es lo que ya hacen `ARCHITECTURE.md` y compañía. Se perdería
justo lo que no está en ningún otro sitio.

**No tocarlos nunca, ni siquiera para avisar** (la lectura estricta de 0027). Deja al
lector a merced de leer los ciento veinticinco para saber cuál manda. Fue lo que
dejó treinta ADR diciendo cifras que ya no eran.

**Un índice aparte con el estado de cada ADR.** Un segundo sitio que mantener y que
envejece sin que se note; el aviso arriba del propio ADR se lee donde se llega.
