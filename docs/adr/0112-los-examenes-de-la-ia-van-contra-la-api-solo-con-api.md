# ADR 0112 — Los exámenes de la IA van contra la API solo con `--api`

Fecha: 2026-10-07 · Estado: aceptada

## Contexto

`pnpm examen:profesor` y `pnpm examen:salidas` pasan el banco de preguntas por el
mismo camino que las rutas: prompt, modelo, validador, reintento y respaldo. Nacieron
para el modelo de casa (Ollama) y **se negaban a correr con `ANTHROPIC_API_KEY`
puesta**, porque con clave contesta la API y se paga. Evitaba un gasto por
descuido, pero también impedía la medida que más falta hace: la del modelo de
pago que verá quien use la aplicación publicada (`docs/MEDIR.md`).

Lo que hay que evitar es gastar sin querer, no medir con el modelo de pago.

## Decisión

1. **Con la API se corre pidiéndolo: `--api`.** Los dos exámenes pasan por
   `scripts/contra-la-api.ts` (`puertaDelExamen`) antes de mandar nada:
   - Sin ningún modelo (`modelProvider()` es `ninguno`): se para y dice qué poner.
   - Con el modelo de casa: pasa, no cuesta nada.
   - Con la API y sin `--api`: se para, y dice cuántas peticiones son, a qué modelo
     y el techo de lo que costarían.
   - Con la API y con `--api`: **imprime el techo** y corre.
2. **El techo sale de `requestCostMicros`**, el mismo cálculo que reparte los cupos
   de los planes: el peor caso de tokens de la petición —con la reserva para pensar
   si el modelo no lo apaga— multiplicado por los dos intentos
   (`MAX_MODEL_ATTEMPTS`) y por el número de peticiones del banco. Es un techo, no
   una previsión: casi nunca se gasta el tope de salida ni hace falta reintentar.
3. **`--releer` no pasa por la puerta**: no le pregunta nada al modelo.
4. El modelo se elige con `OLLAMA_MODEL` (casa) o `ANTHROPIC_MODEL` (API), como en la
   aplicación, y los scripts siguen pidiendo el Node 24 de `nvm`.

## Descartadas

- **Seguir negándose con clave.** Es lo que había. Obliga a borrar la clave del
  `.env` para examinar el modelo de casa y a no poder examinar nunca el de pago,
  que es el que se cobra.
- **Decidirlo por una variable de entorno** (`EXAMEN_CON_API=1`). Se queda puesta en
  el `.env` y vuelve a gastar en la siguiente pasada sin que nadie la pida. Un
  argumento vale para una sola ejecución y queda en el historial del terminal.
- **Correr con clave sin avisar del coste.** La clave basta para gastar, y la cifra
  no se ve hasta la factura. El techo impreso antes de la primera pregunta es lo
  que hace que `--api` sea una decisión informada.

## Consecuencias

- Una pasada contra la API se hace a conciencia, con el techo a la vista, y el
  número sale del mismo código que los cupos: si cambian los precios
  (`MODEL_PRICES`) cambia el aviso sin tocar el script.
- El techo asume los presupuestos de tokens actuales; no cuenta el coste de
  releer ni de otras herramientas.
- `docs/MEDIR.md` explica cómo se mide y qué se hace con lo medido.
