import type { Metadata } from 'next';
import Link from 'next/link';

import { ContarVueltas } from '@features/account/ContarVueltas';
import { modelProvider } from '@server/ai-model';
import { authAvailable } from '@server/auth';
import { mailConfigured } from '@server/mail';
import { loQueFalta, titular } from '@server/titular';
import { Aviso } from '@ui/Aviso';
import { Screen, Section } from '@ui/Screen';

export const metadata: Metadata = {
  title: 'Privacidad',
  description:
    'Qué se guarda de ti, para qué y dónde. El audio no sale de tu aparato, y sin cuenta casi nada sale de tu navegador.',
};

/** Cuándo se revisó por última vez lo que dice esta página contra el código. */
const REVISADA = '7 de octubre de 2026';

const TEXTO = 'text-text-muted max-w-prose';
const LISTA = 'text-text-muted flex max-w-prose list-disc flex-col gap-1.5 pl-5';

/**
 * La política de privacidad (RGPD arts. 13 y 14, LOPDGDD, LSSI-CE art. 22.2).
 *
 * **Dice lo que hace esta copia, no lo que haría cualquiera**: a quién se manda
 * la pregunta al profesor depende de qué modelo esté configurado, y se lee del
 * entorno al pintar; quién la publica, también
 * ([adr/0111](../../../../docs/adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).
 * Si cambia el comportamiento, cambia esta página: lo vigila su test, que lee lo
 * mismo que lee ella.
 *
 * En español llano y por preguntas, que es como se busca algo en una política: no
 * se lee de arriba abajo, se va a lo que preocupa.
 */
export default function Privacidad() {
  const datos = titular();
  const faltan = loQueFalta(datos);
  const modelo = modelProvider();
  const cuentas = authAvailable();

  return (
    <Screen
      title="Privacidad"
      lead="Qué se guarda de ti, para qué y dónde. Lo corto: el audio no sale de tu aparato, y sin cuenta casi nada sale de tu navegador."
      ancho="lectura"
    >
      <Section title="Quién es el responsable">
        {faltan.length > 0 && (
          <Aviso
            anuncio="ninguno"
            className="mb-3 max-w-prose"
            mensaje={`Esta copia no dice todavía quién la publica. Faltan: ${faltan.join(', ')}. Sin esos datos no puede abrirse al público.`}
          />
        )}
        <dl className={`${TEXTO} grid grid-cols-[auto_1fr] gap-x-4 gap-y-1`}>
          <dt className="text-text font-medium">Titular</dt>
          <dd>{datos.nombre ?? 'sin configurar'}</dd>
          <dt className="text-text font-medium">NIF</dt>
          <dd>{datos.nif ?? 'sin configurar'}</dd>
          <dt className="text-text font-medium">Domicilio</dt>
          <dd>{datos.domicilio ?? 'sin configurar'}</dd>
          <dt className="text-text font-medium">Contacto</dt>
          {/* La mono es para el correo, que es un dato; «sin configurar» es una frase. */}
          <dd className={datos.correo === null ? undefined : 'font-mono'}>
            {datos.correo ?? 'sin configurar'}
          </dd>
        </dl>
        <p className={`${TEXTO} mt-3`}>
          A esa dirección se escribe para cualquier cosa de esta página. Los datos completos están
          en el{' '}
          <Link href="/aviso-legal" className="enlace">
            aviso legal
          </Link>
          .
        </p>
      </Section>

      <Section title="Lo que no sale de tu aparato">
        <ul className={LISTA}>
          <li>
            <strong className="text-text">El sonido.</strong> Lo que oye el micrófono se analiza en
            tu navegador y ahí se queda. Lo que grabas se descarga a tu aparato; no se sube a ningún
            sitio, ni con cuenta.
          </li>
          <li>
            <strong className="text-text">Sin cuenta, tu avance y tus ajustes</strong> —la
            tonalidad, el tema, el micrófono elegido, el lienzo de componer— se guardan en tu
            navegador. Son lo que hace funcionar la aplicación, no sirven para nada más y se borran
            borrando los datos del sitio.
          </li>
        </ul>
      </Section>

      <Section title="Si creas una cuenta">
        {!cuentas && (
          <p className={`${TEXTO} mb-3`}>
            Esta copia no tiene cuentas: hoy no se guarda nada de esto.
          </p>
        )}
        <ul className={LISTA}>
          <li>
            Tu correo, tu nombre si lo pones, tu contraseña cifrada (nunca en claro), tu plan y la
            fecha en que declaraste tener 14 años o más.
          </li>
          <li>
            Tu avance: las unidades que superas, la racha, las medallas y las preguntas que
            fallaste. Tus canciones guardadas: grados, tempo y nombres de sección.
          </li>
          <li>Cuántas preguntas a la IA llevas este mes, para descontarlas de tu plan.</li>
          <li>
            Si pides recuperar la contraseña, un vale de un solo uso que caduca en una hora. Se
            guarda su huella, no el vale.
          </li>
          <li>
            Para que la sesión siga abierta, <strong className="text-text">cookies técnicas</strong>
            , solo al entrar. Son necesarias para el servicio que pides y por eso no se pregunta por
            ellas.
          </li>
        </ul>
        <p className={`${TEXTO} mt-3`}>
          Para qué: para darte el servicio que pides al registrarte —llevarte el avance a otro
          aparato, el profesor y lo que abre un plan— (RGPD art. 6.1.b). Hasta cuándo: hasta que
          borres la cuenta, que se hace en{' '}
          <Link href="/cuenta#privacidad" className="enlace">
            tu cuenta
          </Link>{' '}
          y se lleva todo lo anterior. No se usa para publicidad ni se vende a nadie.
        </p>
      </Section>

      <Section title="Si preguntas a la IA">
        <p className={TEXTO}>
          <strong className="text-text">
            Al preguntar al profesor o pedir salidas en componer, hablas con una IA
          </strong>
          , no con una persona, y puede equivocarse. Lo que se le manda es lo que escribes en la
          pregunta y símbolos de música: la tonalidad, la escala, los grados de tu canción y, con el
          plan Medio, qué unidades llevas hechas. Nunca audio, ni tu correo ni tu nombre. No
          escribas en la pregunta nada personal: no hace falta para contestarte.
        </p>
        <p className={`${TEXTO} mt-3`}>
          {modelo === 'anthropic' &&
            'En esta copia contesta un modelo de Anthropic, PBC (Estados Unidos), por su API. La transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. y en su acuerdo de tratamiento de datos; según sus condiciones comerciales, lo que llega por la API no se usa para entrenar sus modelos.'}
          {modelo === 'local' &&
            'En esta copia contesta un modelo que corre en un servidor de quien la publica: la pregunta no sale a ningún otro proveedor.'}
          {modelo === 'ninguno' &&
            'En esta copia no hay modelo configurado: contesta la propia aplicación con lo que sabe de teoría, y la pregunta no sale a nadie.'}
        </p>
      </Section>

      <Section title="Lo que se cuenta del uso">
        <p className={TEXTO}>
          Para saber qué se usa y si quien prueba la aplicación vuelve, se cuenta en nuestra propia
          base de datos, <strong className="text-text">sin cookies y sin servicios de fuera</strong>
          : qué pantallas se abren, cuándo se termina una unidad, se guarda una canción o se graba
          una toma. Ni lo que escribes, ni lo que suena, ni tu dirección IP.
        </p>
        <ul className={`${LISTA} mt-3`}>
          <li>
            <strong className="text-text">Sin cuenta</strong>, se suma y ya: una visita más a esa
            pantalla ese día, sin nada que diga de quién. Solo si dices que sí abajo, tu navegador
            guarda un número al azar para saber si vuelves otro día (LSSI art. 22.2; RGPD art.
            6.1.a).
          </li>
          <li>
            <strong className="text-text">Con cuenta</strong>, los días en que entras se apuntan con
            un seudónimo de ella —una huella cifrada con una clave del servidor, no tu correo ni tu
            identificador—. Es interés legítimo en saber si la aplicación sirve (RGPD art. 6.1.f), y
            te puedes oponer escribiendo a la dirección de arriba. Al borrar la cuenta se borra.
          </li>
          <li>
            Los días de cada uno se borran a los <strong className="text-text">trece meses</strong>.
            Lo sumado no es de nadie y se queda.
          </li>
          <li>
            Si tu navegador manda <span className="font-mono">Do Not Track</span> o{' '}
            <span className="font-mono">Global Privacy Control</span>, no se cuenta nada.
          </li>
        </ul>
        <div className="mt-4">
          <ContarVueltas />
        </div>
      </Section>

      <Section title="Quién más interviene">
        <ul className={LISTA}>
          <li>
            Quien aloja el servidor:{' '}
            {datos.alojamiento ?? 'sin configurar en esta copia (TITULAR_ALOJAMIENTO)'}. Como
            cualquier servidor, puede guardar registros técnicos de acceso.
          </li>
          {mailConfigured() && (
            <li>
              Para mandar el correo de recuperar la contraseña, Resend, Inc. (Estados Unidos), que
              recibe tu correo y el enlace.
            </li>
          )}
          <li>
            Para frenar abusos, la dirección IP cuenta los intentos —entrar, registrarse, preguntar
            a la IA— mientras dura cada tope, que son minutos, y se borra después. En la analítica,
            ni eso: solo su huella.
          </li>
          <li>Hoy no se cobra nada, así que no hay pasarela de pago ni datos de tarjeta.</li>
        </ul>
      </Section>

      <Section title="Menores">
        <p className={TEXTO}>
          Para crear una cuenta hay que tener 14 años o más (LOPDGDD art. 7). Por debajo, la
          aplicación funciona entera sin cuenta, con el avance en el navegador.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p className={TEXTO}>
          Puedes pedir ver lo que hay de ti, corregirlo, borrarlo, llevártelo, limitar su uso u
          oponerte, escribiendo a la dirección de contacto. Borrar la cuenta lo puedes hacer tú
          mismo desde tu cuenta. Si crees que no se ha hecho bien, puedes reclamar ante la Agencia
          Española de Protección de Datos (aepd.es).
        </p>
        <p className={`${TEXTO} mt-3`}>Revisada el {REVISADA}.</p>
      </Section>
    </Screen>
  );
}
