import type { Metadata } from 'next';
import Link from 'next/link';

import { loQueFalta, titular } from '@server/titular';
import { Aviso } from '@ui/Aviso';
import { Screen, Section } from '@ui/Screen';

export const metadata: Metadata = {
  title: 'Aviso legal',
  description: 'Quién publica Caos ordenado, cómo contactar y las condiciones de uso.',
};

const TEXTO = 'text-text-muted max-w-prose';

/**
 * El aviso legal que pide la LSSI-CE (art. 10): quién está detrás y cómo se le
 * escribe, más las condiciones de uso.
 *
 * Los datos del titular salen del entorno y **no se inventan**: si faltan, la
 * página lo dice con el nombre de la variable que hay que poner
 * ([adr/0111](../../../../docs/adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).
 */
export default function AvisoLegal() {
  const datos = titular();
  const faltan = loQueFalta(datos).filter((v) => v !== 'TITULAR_ALOJAMIENTO');

  return (
    <Screen
      title="Aviso legal"
      lead="Quién publica esto, cómo escribirle y en qué condiciones se usa."
      ancho="lectura"
    >
      <Section title="Quién lo publica">
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
          <dt className="text-text font-medium">Correo</dt>
          {/* La mono es para el correo, que es un dato; «sin configurar» es una frase. */}
          <dd className={datos.correo === null ? undefined : 'font-mono'}>
            {datos.correo ?? 'sin configurar'}
          </dd>
        </dl>
      </Section>

      <Section title="Qué es esto">
        <p className={TEXTO}>
          Caos ordenado es una aplicación para aprender música y componer: escucha lo que tocas por
          el micrófono, enseña teoría por unidades y propone por dónde seguir. Hoy se usa gratis y
          no se cobra nada. Qué se hace con tus datos está en la{' '}
          <Link href="/privacidad" className="enlace">
            política de privacidad
          </Link>
          .
        </p>
      </Section>

      <Section title="Condiciones de uso">
        <ul className="text-text-muted flex max-w-prose list-disc flex-col gap-1.5 pl-5">
          <li>
            Es para uso personal. No se permite usarla para atacar el servicio, saltarse sus topes
            ni sacar en bloque lo que contesta la IA.
          </li>
          <li>
            Lo que contesta el profesor y lo que proponen las salidas lo escribe una IA. Es una
            ayuda para aprender, no una verdad: puede equivocarse.
          </li>
          <li>
            Se hace lo posible por que funcione, pero se ofrece tal cual, sin garantía de que esté
            siempre disponible ni de que reconozca bien todo lo que tocas.
          </li>
          <li>
            Lo que compones es tuyo. El código, los textos y los dibujos de la aplicación son de su
            titular.
          </li>
          <li>
            Para crear una cuenta hay que tener 14 años o más. La aplicación sin cuenta la puede
            usar cualquiera.
          </li>
          <li>Se rige por la ley española.</li>
        </ul>
      </Section>
    </Screen>
  );
}
