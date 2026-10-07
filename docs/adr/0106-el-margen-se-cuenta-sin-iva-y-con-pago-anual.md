# ADR 0106 — El margen se cuenta sobre lo que entra, y se puede pagar al año

Fecha: 2026-10-07 · Estado: aceptada · Corrige: el presupuesto de
[ADR 0008](./0008-los-cupos-salen-del-precio.md) · Usa: la comisión de
[ADR 0105](./0105-la-pasarela-y-los-precios-por-pais.md)

## Contexto

[adr/0008](./0008-los-cupos-salen-del-precio.md) calculó los cupos para dejar un
**60 % de margen**: el 40 % del precio podía irse en modelo, y el 60 % restante pagaba
«servidor, base de datos, la comisión de la pasarela cuando la haya, el IVA» y dejaba
beneficio. La cuenta partía del precio **con IVA**:

```
presupuesto = 4,99 € × 40 %
```

Y el IVA no es nuestro. De 4,99 € se van 0,87 de IVA (21 %) y, con la pasarela
decidida en [adr/0105](./0105-la-pasarela-y-los-precios-por-pais.md), hasta 0,68 de
comisión: entran 3,44 €. El 40 % del precio eran 2,00 € de modelo sobre 3,44 de
ingreso. El estudio de negocio lo midió, y aquí está repetido con la comisión del
peor caso y Opus 5, el modelo de entonces:

| Plan   | Precio  | Gasto del peor mes | Lo que entra | Margen de verdad |
| ------ | ------- | ------------------ | ------------ | ---------------- |
| Básico | 4,99 €  | 1,97 $             | 3,44 €       | 42,7 %           |
| Medio  | 9,99 €  | 4,00 $             | 7,14 €       | 44,0 %           |
| Pro    | 19,99 € | 7,99 $             | 14,54 €      | 45,0 %           |

El «60 %» era un 43–45 %. Ningún plan perdía dinero, y el test del margen pasaba,
porque comparaba el gasto con el precio con IVA: comprobaba la misma cuenta que estaba
mal.

Y había una petición aparte: **pagar al año**, con unos dos meses gratis, que es lo que
espera quien va a estudiar un curso entero.

## Decisión

**El presupuesto sale de lo que entra, no del precio.** En `core/billing/cost.ts`:

```
lo que entra de un cobro = precio / 1,21 − (precio × 8,65 % + 0,25 €)
lo que entra al mes      = el menor entre el cobro mensual y el anual entre doce
presupuesto              = lo que entra al mes × 40 %
```

- **IVA: 21 %, el de España, y es un supuesto explícito** (`IVA_POR_CIENTO`). La
  pasarela cobra el de cada país; con el precio igual en todas partes, en Hungría
  (27 %) se queda en un 58 % y en Luxemburgo (17 %) sube.
- **Comisión: el peor caso de Stripe Managed Payments**, 8,65 % + 0,25 €
  (`COMISION_PUNTOS_BASICOS`, `COMISION_FIJA_CENTS`). Sobre el precio con IVA, que es
  como la cobra la pasarela.
- **Todo en enteros y redondeando contra nosotros**, como el resto del fichero.
- **El margen se comprueba sobre lo que entra**: el test pide que el gasto del peor
  mes no pase del 40 % de lo que entra, con cada modelo de la tabla y con uno
  desconocido.

**El pago anual son diez meses: dos gratis** (`MESES_QUE_SE_PAGAN_AL_AÑO`). El precio
anual no se escribe: se calcula desde el mensual, así que el «dos meses gratis» de la
pantalla no puede dejar de ser verdad.

| Plan   | Al mes | Al año  | Entra al mes (mensual) | Entra al mes (anual) |
| ------ | ------ | ------- | ---------------------- | -------------------- |
| Básico | 4,99 € | 49,90 € | 3,44 €                 | 3,06 €               |
| Medio  | 9,99 € | 99,90 € | 7,14 €                 | 6,14 €               |

**El cupo es uno por plan, y sale del anual**, que es el que menos deja al mes. Quien
paga al mes deja más y recibe lo mismo: el anual es un descuento, no otro producto, y
no hace falta guardar en la cuenta cómo paga cada uno. **El periodo solo elige el
precio**: viaja de la pantalla a `/api/plan` y de ahí al cobrador (`Billing.start`
recibe `periodo`), que en Stripe es otro identificador de precio
(`STRIPE_PRICE_BASICO_ANUAL`, `STRIPE_PRICE_MEDIO_ANUAL`). El webhook traduce el
precio anual al mismo plan. Cambiar de mensual a anual con la suscripción viva va por
el portal, como cambiar de plan ([adr/0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md)).

En la pantalla, el anual va debajo del mensual en cada tarjeta, en pequeño, y se elige
en la ventana de pago con un selector que viene en «al mes».

Con el modelo por defecto de [adr/0103](./0103-los-modelos-vigentes-y-el-de-por-defecto.md):

|        | Antes (Opus 5, sobre el precio)  | Ahora (Sonnet 5.5, sobre lo que entra) |
| ------ | -------------------------------- | -------------------------------------- |
| Básico | 73/mes · 12/día · margen 42,7 %  | 113/mes · 19/día · margen 60,1 %       |
| Medio  | 148/mes · 24/día · margen 44,0 % | 227/mes · 37/día · margen 60,1 %       |

Con Opus 5 y la cuenta bien hecha habrían sido 45 y 90: arreglar el margen sin cambiar
de modelo bajaba los cupos un 38 %.

## Alternativas descartadas

**Subir la parte gastable para conservar los cupos.** Poner el 65 % en vez del 40 %
dejaba los números de antes y un margen de verdad del 35 %. Es cambiar la decisión de
negocio para no tocar la cuenta, y la decisión era el 60 %.

**Subir los precios para que el 60 % fuera verdad con los cupos de antes.** Básico
pasaría de 4,99 € a unos 8,10. El precio lo eligió el usuario, y el problema era la
cuenta, no el precio.

**Contar el IVA más alto de la Unión, el 27 %.** Es lo que pediría la regla del peor
caso, y la tarea fija el 21 % como supuesto. La diferencia son dos puntos de margen en
las ventas húngaras; queda escrita con su número en vez de escondida.

**Contar la comisión de tarjeta europea**, 5 % + 0,25 €. Es la más probable si casi
todas las ventas son europeas, y subiría los cupos un 5 %. No hay ni una venta que lo
diga; cuando las haya, se baja con datos.

**Un cupo distinto para quien paga al año**, más pequeño. Es el más justo con el
dinero, y pide guardar el periodo en la cuenta y explicar dos números en cada tarjeta
para un plan que es el mismo. La diferencia es pequeña y va a favor de quien paga al
mes, que es quien más deja.

**Un mes gratis en vez de dos**, o tres. Uno no se nota —«un 8 % menos»—; tres bajan
el cupo de todos, que se calcula con el anual. Dos es lo que se entiende sin hacer
cuentas.

**El anual como precio escrito**, 49 € redondos. Se lee mejor que 49,90, y es un
número que puede separarse del mensual sin que nada avise: con el calculado, cambiar
el mensual cambia el anual y su «dos meses gratis» sigue siendo verdad.

## Consecuencias

- **El 60 % es verdad** con todos los modelos de la tabla: 60,1 % con el de por
  defecto, y un test lo comprueba sobre lo que entra.
- Bajar de modelo o de comisión sube los cupos sin tocar código; subir el IVA supuesto
  o la comisión los baja. Los tres números tienen nombre en `cost.ts`.
- Hacen falta **cuatro precios en Stripe**, no dos, y sin los anuales el cobrador de
  verdad no se activa: la pantalla ofrece el anual siempre
  ([DESPLIEGUE.md](../DESPLIEGUE.md#variables-de-entorno)).
- El periodo no se guarda en la cuenta. Si un día se quiere enseñar «pagas al año y se
  renueva el día tal», habrá que leerlo de la pasarela.
