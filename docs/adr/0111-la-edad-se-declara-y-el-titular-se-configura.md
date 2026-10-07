# ADR 0111 — La edad se declara, y quien publica sale del entorno

Fecha: 2026-10-07 · Estado: aceptada

## Contexto

Para abrir la aplicación al público, aunque sea sin cobrar, hacen falta tres cosas
que no había:

- **Un aviso legal** con quién la publica (LSSI-CE art. 10: nombre, NIF, domicilio,
  correo).
- **Una política de privacidad** que diga la verdad de lo que hace esta copia
  (RGPD arts. 13 y 14), incluido a quién se manda la pregunta al profesor, que
  depende de qué modelo esté configurado.
- **Una edad mínima para la cuenta.** En España, por debajo de 14 años el
  consentimiento lo dan los padres (LOPDGDD art. 7). Y el AI Act (art. 50.1) pide que
  quien habla con una IA lo sepa.

## Decisión

1. **Los datos del titular salen del entorno** —`TITULAR_NOMBRE`, `TITULAR_NIF`,
   `TITULAR_DOMICILIO`, `TITULAR_CORREO` y `TITULAR_ALOJAMIENTO`—, leídos en el
   servidor en cada petición (`server/titular.ts`). Si falta alguno, las dos páginas
   lo dicen con el nombre de la variable y que **sin ellos no se abre al público**.
   Van sin `NEXT_PUBLIC_`: son públicos, pero esas se escriben en el paquete al
   construir, y el camino del contenedor construye sin variables.
2. **`/privacidad` y `/aviso-legal` son páginas de servidor dentro del marco**, y
   leen lo mismo que la aplicación: `modelProvider()` decide si se nombra a
   Anthropic (EE. UU., Marco de Privacidad de Datos), un modelo propio o ninguno;
   `mailConfigured()` si se nombra al proveedor de correo; `authAvailable()` si hay
   cuentas. Se enlazan desde el registro, la cuenta y el profesor.
3. **La edad se declara con un «sí» o un «no», sin nada marcado al empezar.** Por
   debajo de 14 no se crea la cuenta y se dice que sin ella funciona igual. Lo
   comprueba también el servidor (`createUser` exige `mayorDe14 === true`, antes de
   mirar el correo y antes de cifrar), y la cuenta guarda **cuándo** se declaró
   (`users.mayor_de_14_en`). Las cuentas de antes quedan con nulo: no se inventa una
   declaración que nadie hizo.
4. **El aviso de que se habla con una IA va donde se pregunta**, encima de la
   pregunta al profesor, y otra vez en la política.

## Descartadas

- **Escribir los datos del titular en el código.** Es lo más corto, y un NIF de
  ejemplo publicado parece cumplir sin identificar a nadie. Además cada copia —la de
  casa, la de pruebas— tiene su responsable.
- **Variables `NEXT_PUBLIC_`.** Se hornean al construir: el contenedor construido
  sin ellas las serviría vacías para siempre.
- **Pedir la fecha de nacimiento.** Comprueba lo mismo —que es una declaración— y
  guarda un dato más que no sirve para nada después.
- **Una casilla «tengo 14 años o más» marcada por defecto.** No es una declaración
  de nadie. Y una sin marcar haría falta escribirla a mano: los controles son tres
  (`docs/ESTILO.md`) y ninguno es una casilla; `ui/Segmentado` sí lo es.
- **Consentimiento de los padres por debajo de 14.** Pide comprobar quién es el
  padre, que no hay cómo hacer sin datos que no queremos. Sin cuenta, la aplicación
  la puede usar cualquiera.
- **Verificar la edad de verdad** (documento, tercero). Desproporcionado para una
  cuenta que guarda unidades superadas.

## Consecuencias

- **Abrir al público exige poner cinco variables**, y las páginas lo recuerdan
  mientras falten. Está en `docs/DESPLIEGUE.md` y en `PARA-PUBLICAR.md`.
- **Que no se pueda cobrar a un menor no lo garantiza esto**: es una declaración.
  Cobrar pedirá más (`PARA-PUBLICAR.md`).
- Que Anthropic siga en el Marco de Privacidad de Datos se comprueba a mano antes de
  abrir: si sale de la lista, la frase de la política deja de ser verdad.
- Los textos legales los ha escrito quien programa, no un abogado. Lo que dicen de
  la aplicación está comprobado contra el código; lo que dicen de la ley conviene
  que lo lea alguien que sepa.
