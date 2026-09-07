# Historia: cómo se llegó hasta aquí

Veinte fases, de un `package.json` vacío a una aplicación que escucha, enseña y
compone. **Aquí solo está lo que se hizo y en qué orden**; lo que falta está en
[ROADMAP.md](./ROADMAP.md) y el porqué de cada decisión, en [adr/](./adr/).

Esto existe porque el orden importó: casi todas las fases salieron de un fallo o
de una limitación de la anterior, y esa cadena explica el proyecto mejor que
cualquier descripción.

| Fase   | Qué trajo                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------- |
| **0**  | Esqueleto y dominio puro: Next, TypeScript con alias, Vitest, y `core/` sin navegador.          |
| **1**  | Detección de tono propia por autocorrelación, y el afinador.                                    |
| **2**  | Rueda de quintas y mástil. La afinación y los trastes suben a `core/instrument`.                |
| **3**  | Modo aprender: el ejercicio como máquina de estados pura, con el instante por parámetro.        |
| **4**  | Modo componer: los siete grados, los caminos entre ellos y el porqué de cada uno.               |
| **5**  | Ideas de IA. Nace `app/api/ideas` y la regla de que el SDK vive en un solo fichero.             |
| **6**  | Grabación con cámara, con el vídeo compuesto en un canvas y descargado en local.                |
| **7**  | Persistencia local de sesiones sobre IndexedDB, con la interfaz por delante.                    |
| **8**  | Cuentas y planes. Nace `src/server/`, que solo abre `app/` y ESLint vigila en los dos sentidos. |
| **9**  | Aprender como una aplicación de idiomas: XP, racha, medallas y desbloqueo lineal.               |
| **10** | Una pantalla por cosa, y elegir por dónde empezar. Aparecen los tres planes de pago.            |
| **11** | Que los cupos cuadren con el dinero: dejan de escribirse a mano y se calculan del precio.       |
| **12** | El avatar, el registro y los ajustes de la cuenta.                                              |
| **13** | Docker: Postgres, migraciones y aplicación en un comando.                                       |
| **14** | Que parezca una aplicación y no nueve pantallas: un solo marco, dos temas, tokens.              |
| **15** | Rodaje con guitarra real. Salió el fallo del micro mudo, que ningún test podía ver.             |
| **16** | Canciones en tu cuenta: el modelo de datos con sus secciones y sus topes.                       |
| **17** | Versiones de tu canción, verificadas contra el dominio movimiento a movimiento.                 |
| **18** | Cobrar de verdad: escrita como puerto y **sin ejecutar nunca**.                                 |
| **19** | Lo que exige publicar: borrar la cuenta, echar sesiones, correo como puerto, vale de un uso.    |
| **20** | Semilla multiinstrumento: se decide **no** construirla todavía, y por qué.                      |

Después de la veinte, en un solo día (26 de agosto de 2026):

| Qué                                                                                         |
| ------------------------------------------------------------------------------------------- |
| Un modelo de casa —Ollama— para poder preguntarle a la IA sin clave y sin factura.          |
| El esquema de las ideas deja de pedir de menos: de 0 de 4 peticiones válidas a 36 de 36.    |
| Un solo canal de texto libre, y el profesor declara si le preguntan de música.              |
| El sonido se guarda y al parar se vuelve a escuchar entero, con ventana cuatro veces mayor. |
| Las versiones pasan a ser **salidas**: canciones distintas con sus partes, no retoques.     |
| Repaso de toda la aplicación: código muerto fuera, tres fallos reales arreglados.           |
| Componer gana una segunda cara: la canción por bloques que se arrastran y suenan.           |
| El punteo, en rejilla o en partitura, y los acordes se escriben o se arrastran.             |
| Lo que se oye llega con su duda, se dice qué no se supo leer y se puede corregir.           |
| Qué nota puede seguir, siempre a la vista, y el punteo que tocas cae en la partitura.       |
| Aprender gana unidades de oído: suena un acorde en tu tonalidad y dices qué era.            |
| Remate: el lienzo se guarda, los acordes se reordenan escritos y el bVII deja de ser A#.    |

## Los fallos que enseñaron algo

De todo lo de arriba, lo que conviene no olvidar son los tropiezos, porque casi
ninguno se veía leyendo el código:

- **El micro se quedaba mudo** y había que pararlo y arrancarlo otra vez. Solo
  apareció con una guitarra delante, en la fase 15.
- **Los cupos de IA perdían dinero**: cuarenta al día son mil doscientas al mes, y
  nadie lo había multiplicado. De ahí salió `core/billing/cost.ts` (fase 11).
- **El ROADMAP llegó a afirmar que el reconocimiento de acordes era imposible**
  cuando llevaba dos commits funcionando. De ahí la regla de actualizar el
  documento que describía lo que cambias.
- **El esquema de las ideas no exigía lo que el validador daba por hecho**, así
  que el modelo devolvía respuestas impecables que se barrían enteras y la ruta
  contestaba 502 con el cupo ya gastado.
- **Medir el ruido con un percentil no vale si no hay silencio**: el umbral subía
  por encima de la propia guitarra y detectaba cero acordes en ocho segundos.
- **Un reloj de tres minutos leía la grabadora equivocada** y cortaba por la mitad
  una grabación posterior.
