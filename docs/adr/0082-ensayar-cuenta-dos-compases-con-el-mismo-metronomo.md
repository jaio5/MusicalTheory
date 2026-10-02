# ADR 0082 — Ensayar cuenta dos compases con el mismo metrónomo

Fecha: 2026-10-02 · Estado: aceptada · Amplía
[ADR 0072](./0072-la-claqueta-suena-toda-la-toma.md), que dejó la cuenta atrás para
Tocando y el ensayo la repite

## Contexto

Tocando cuenta dos compases antes de apuntar y el compás uno cae **un pulso después
del último clic** ([ADR 0072](./0072-la-claqueta-suena-toda-la-toma.md), y antes el
0053). El ensayo no contaba nada: el primer clic ya era el compás uno, así que el
acorde se encendía a la vez que había que tocarlo y el primer compás salía fallado
casi siempre. Eso es puntuar el reflejo y no la canción.

## Decisión

**El ensayo reutiliza `contarAtras` (`state/cuenta-atras.ts`) con el mismo metrónomo
que lleva la canción**, sin pararlo entre una cosa y otra: los clics de después de la
cuenta son los pulsos del ensayo, y el primero es el compás uno. Se enciende el
acorde con el último clic de cuenta, que es cuando hace falta verlo.

- **El ensayo marca la toma en la claqueta** (`marcarToma`) mientras dura la cuenta y
  el ensayo: el metrónomo de la barra se aparta —dos metrónomos a la vez son dos pulsos
  que no coinciden— y lo que mira si hay una toma sonando se entera, como con Tocando.
- **La cuenta no se anuncia** a quien usa un lector de pantalla y **se corta con el
  mismo botón** que para el ensayo. Cortada, no se ha empezado nada: no se puntúa, se
  suelta el micro y se vuelve a como estaba. Irse de la pantalla en mitad de la cuenta
  hace lo mismo.

## Consecuencias

El primer compás del ensayo se puntúa tocando, no reaccionando. Empezar tarda dos
compases más. Y el ensayo comparte con Tocando la regla que más duele cambiar: **el
compás uno cae un pulso después del último clic**; equivocarlo desplaza el ensayo
entero un pulso.

## Alternativas descartadas

**Dos metrónomos, uno para contar y otro para llevar la canción.** El compás uno
caería donde cayera el arranque del segundo, no un pulso después del último clic de
cuenta.

**Parar después de la cuenta y volver a arrancar.** Es el mismo problema con otro
nombre: el reinicio mete un retraso que no se puede predecir.

**Una fase `contando` en la máquina del ensayo.** Es un estado más que atender en
todo lo que mira la fase; la cuenta ya vive dentro de la fase `preparando`, con su
propio contador y su propio `terminada`, y la fase solo pasa a `ensayando` cuando
empieza lo que se puntúa.

**No contar.** Es lo que había, y puntuaba el reflejo.
