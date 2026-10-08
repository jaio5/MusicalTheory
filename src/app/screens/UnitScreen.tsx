'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lazy, Suspense, useEffect, useState } from 'react';

import { can, cheapestPlanWith, nextAllowedUnit, unitAccess } from '@core/billing';
import { findUnit, type PlayUnit, type Unit } from '@core/music';
import { olvidarSitio } from '@features/learn/sitio-en-la-unidad';
import { UnidadPorMomentos } from '@features/learn/UnidadPorMomentos';
import { UnitDone } from '@features/learn/UnitDone';
import { useProgress, type Celebration } from '@features/learn/use-progress';
import { BarraDeTonalidad } from '@features/wheel';
import { useAccount } from '@state/account';
import { selectActiveKey, TONALIDAD_DE_PARTIDA, useSessionStore } from '@state/session-store';
import { estiloBoton } from '@ui/Button';
import { IconoCamino, IconoCandado } from '@ui/icons';
import { PlanLock } from '@ui/PlanLock';
import { Screen, WorkHeader } from '@ui/Screen';
import { Vacio } from '@ui/Vacio';

/**
 * **Cada unidad descarga lo de su tipo, y nada más.** Las tres venían en el
 * paquete de la pantalla: una unidad de teoría se traía los ejercicios de oído
 * de todo el temario y el afinador de la de tocar, y una de oído, todas las
 * lecciones. Era un trozo de 111 KB —34 comprimido— y `/aprender/[unidad]` la
 * ruta más pesada de la aplicación. Ahora cada tipo llega en el suyo, pedido de
 * su módulo y no del índice de `features/learn`, que lo traería de golpe
 * ([adr/0120](../../../docs/adr/0120-la-primera-visita-no-se-mueve-y-cada-pantalla-trae-lo-suyo.md)).
 *
 * No choca con que el texto del Grado Profesional viaje
 * ([adr/0116](../../../docs/adr/0116-el-avance-que-sube-se-comprueba.md)): sigue
 * viajando, solo que a quien abre una unidad de ese tipo.
 */
const TheoryUnit = lazy(() =>
  import('@features/learn/TheoryUnit').then((modulo) => ({ default: modulo.TheoryUnit })),
);
const EarUnit = lazy(() =>
  import('@features/learn/EarUnit').then((modulo) => ({ default: modulo.EarUnit })),
);
const cargarLaPrueba = () => import('@features/learn/LearnPanel');
const LearnPanel = lazy(() => cargarLaPrueba().then((modulo) => ({ default: modulo.LearnPanel })));

/** El sitio de lo que llega aparte, mientras llega: dicho, no un hueco. */
function Abriendo({ que }: { readonly que: string }) {
  return (
    <p role="status" className="text-text-muted p-4 text-center text-base">
      Abriendo {que}…
    </p>
  );
}

/**
 * Una unidad, a pantalla completa y con su propia dirección.
 *
 * Con dirección propia se puede enlazar, volver atrás con el botón del navegador y
 * dejarla a medias sin perder el sitio. Y sobre todo: mientras se contesta no hay
 * nada más en pantalla, que es la mitad de por qué esto funciona.
 *
 * La tonalidad está aquí porque las preguntas se generan con los acordes de la
 * tonalidad en la que estés. En una barra que se despliega, no ocupando media
 * pantalla, y **sin pedirla**: mientras no elijas una, la unidad va en Do mayor
 * (`TONALIDAD_DE_PARTIDA`). Pedirla bloqueaba la primera unidad, la de las notas,
 * a quien todavía no sabía qué es una tonalidad
 * ([adr/0109](../../../docs/adr/0109-lo-que-se-da-por-hecho-al-empezar.md)).
 */
export function UnitScreen({ unitId }: { readonly unitId: string }) {
  const router = useRouter();
  const { account, signedIn } = useAccount();
  const { progress, day, celebration, dismissCelebration, complete, miss } = useProgress();
  const activeKey = useSessionStore(selectActiveKey);
  /**
   * Si la rueda está abierta tapando la unidad.
   *
   * La barra flota sobre la pregunta, así que abierta la tapa entera: verla no
   * se ve, pero seguía recibiendo el foco, y el tabulador caía en botones que
   * no se veían (WCAG 2.4.11). Mientras dura, lo de abajo va `inert`. Es el
   * mismo trato que en componer. Nace plegada —con la de partida no hay nada
   * que pedir— y a partir de ahí manda ella.
   */
  const [tapadoPorLaRueda, setTapadoPorLaRueda] = useState(false);

  const found = findUnit(unitId);
  const acceso = unitAccess(progress, account.plan, unitId);
  const repasa = can(account.plan, 'repaso');

  // La página ya contesta 404 a una unidad que no está en el temario; esto queda
  // para la pantalla montada suelta, que no sabe de dónde le llega el nombre.
  if (found === null) {
    return (
      <Marco titulo="Esta unidad no existe">
        {/* Con la salida escrita como botón: decir «vuelve al camino» y dejar la
            vuelta en el enlace pequeño de arriba era pedir sin ofrecer. */}
        <Vacio
          icono={<IconoCamino />}
          titulo="No está en el temario"
          accion={
            <Link href="/aprender" className={estiloBoton('primary')}>
              Volver al camino
            </Link>
          }
        >
          Puede que se haya renombrado o retirado. Vuelve al camino y sigue por donde ibas.
        </Vacio>
      </Marco>
    );
  }

  if (acceso === 'por-plan') {
    return (
      <Marco titulo={found.unit.title}>
        <p className="text-text-muted max-w-prose text-base">
          Es del Grado Profesional. Los cuatro cursos del Elemental —el lenguaje musical— son gratis
          y lo seguirán siendo; los seis del Profesional —la armonía: funciones y cadencias,
          inversiones, séptimas, modulación, cromatismo y modos— van con plan.
        </p>
        <div className="mt-4 max-w-prose">
          <PlanLock
            needed={cheapestPlanWith('grado-profesional')}
            what="El Grado Profesional"
            signedIn={signedIn}
          />
        </div>
      </Marco>
    );
  }

  if (acceso === 'por-temario') {
    // La que toca es la primera abierta y sin hacer desde tu punto de partida:
    // la misma que ofrece el botón de seguir del camino.
    const laQueToca = nextAllowedUnit(progress, account.plan);
    return (
      <Marco titulo={found.unit.title}>
        <Vacio
          icono={<IconoCandado />}
          titulo="Todavía no está abierta"
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              {/* v8 ignore next 5 -- si esta está cerrada es que falta alguna antes: la que toca existe */}
              {laQueToca !== null && (
                <Link href={`/aprender/${laQueToca}`} className={estiloBoton('primary')}>
                  Ir a la que toca
                </Link>
              )}
              <Link href="/aprender" className={estiloBoton('quiet')}>
                Cambiar el punto de partida
              </Link>
            </div>
          }
        >
          Se abre al terminar la anterior. Si quieres empezar por aquí, cambia tu punto de partida
          en el camino y esta unidad se abre sola.
        </Vacio>
      </Marco>
    );
  }

  // Terminada: se enseña lo ganado y se ofrece la siguiente. La celebración vive en
  // esta pantalla y no en el camino porque es el final de lo que se acaba de hacer.
  if (celebration !== null && celebration.unitId === unitId) {
    return (
      <Siguiente
        celebration={celebration}
        progress={progress}
        day={day}
        onNext={() => {
          dismissCelebration();
          const siguiente = nextAllowedUnit(progress, account.plan);
          router.push(siguiente === null ? '/aprender' : `/aprender/${siguiente}`);
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader
        title={found.unit.title}
        lead={`${found.course.year}º de ${
          found.course.grade === 'elemental' ? 'Elemental' : 'Profesional'
        } · ${found.course.title}`}
        back={{ href: '/aprender', label: 'Camino' }}
        actions={
          <p className="text-text-muted font-mono text-xs tabular-nums">{found.unit.xp} XP</p>
        }
      />

      {/* La tonalidad, en una barra que se abre. Cerrada ocupa una línea y dice en
          qué tonalidad estás, que es lo único que hay que saber mientras contestas. */}
      {/* `shrink-0`: lo que se abre flota sobre la pregunta en vez de quitarle
          altura, así que la barra mide su rótulo y no negocia nada. */}
      <BarraDeTonalidad
        className="border-border bg-surface shrink-0 border-b px-4"
        onAbrirse={setTapadoPorLaRueda}
        dePartida={TONALIDAD_DE_PARTIDA}
      >
        <p className="text-text-muted max-w-prose text-center text-xs">
          {activeKey === null
            ? 'Mientras no elijas otra, la unidad va en C mayor —Do mayor—, la que no lleva alteraciones. '
            : ''}
          Las preguntas se escriben con los acordes de esta tonalidad. Cámbiala y las mismas
          preguntas hablan de otros acordes.
        </p>
      </BarraDeTonalidad>

      {/* **Y se ve que está apagado.** Con `inert` a secas la tarjeta de la
          presentación seguía entera y a todo color bajo el panel, con su
          «Empezar» pidiendo que lo pulsaran: parecía viva y no respondía.
          La variante `inert:` la atenúa mientras dure —la misma que usa
          componer—, que es lo que dice «ahora no» sin una palabra, y sin una
          clase que cambie al hidratar. */}
      <div
        className="mx-auto min-h-0 w-full max-w-2xl grow overflow-y-auto inert:opacity-50 inert:saturate-50"
        inert={tapadoPorLaRueda}
      >
        {/* `key`: otra unidad es otra unidad, aunque la pantalla siga montada al
            ir de una a otra. Sin ella se heredaban el momento y la pregunta en
            la que iba la anterior. */}
        <Suspense fallback={<Abriendo que="la unidad" />}>
          <UnidadDeSuTipo
            key={unitId}
            unit={found.unit}
            yaHecha={acceso === 'hecha'}
            onDone={(flawless) => {
              // Terminada, la próxima vez se empieza de nuevo y no por donde iba.
              olvidarSitio(unitId);
              complete(unitId, flawless);
            }}
            {...(repasa ? { onMiss: (index: number) => miss(unitId, index) } : {})}
          />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * La unidad según su tipo: se lee, se oye o se toca. Cada uno llega en su trozo,
 * y mientras llega se dice.
 */
function UnidadDeSuTipo({
  unit,
  yaHecha,
  onDone,
  onMiss,
}: {
  readonly unit: Unit;
  readonly yaHecha: boolean;
  readonly onDone: (flawless: boolean) => void;
  readonly onMiss?: (index: number) => void;
}) {
  const repaso = onMiss === undefined ? {} : { onMiss };
  if (unit.kind === 'theory') {
    return <TheoryUnit unit={unit} yaHecha={yaHecha} onDone={onDone} {...repaso} />;
  }
  if (unit.kind === 'ear') {
    return <EarUnit unit={unit} onDone={onDone} {...repaso} />;
  }
  return <UnidadDeTocar unit={unit} onDone={onDone} {...repaso} />;
}

/**
 * La de tocar también se presenta antes: «tócala» sin saber qué escala ni para
 * qué es pedir a ciegas, y el micro se abre en cuanto se empieza. Las notas que
 * costaron entran en la cola igual que una pregunta fallada. Terminar la escala
 * sigue siendo terminarla —aquí no se suspende— pero lo que salió regular vuelve.
 *
 * **La prueba se pide mientras se lee la presentación**: llega aparte —trae el
 * tono de referencia y la escucha— y al pulsar «Empezar» ya suele estar.
 */
function UnidadDeTocar({
  unit,
  onDone,
  onMiss,
}: {
  readonly unit: PlayUnit;
  readonly onDone: (flawless: boolean) => void;
  readonly onMiss?: (index: number) => void;
}) {
  useEffect(() => {
    void cargarLaPrueba();
  }, []);

  return (
    <div className="p-4">
      <UnidadPorMomentos
        unit={unit}
        prueba={
          <Suspense fallback={<Abriendo que="la prueba" />}>
            <LearnPanel
              scaleId={unit.scaleId}
              onDone={(stumbled) => {
                for (const index of stumbled) {
                  onMiss?.(index);
                }
                onDone(stumbled.length === 0);
              }}
            />
          </Suspense>
        }
      />
    </div>
  );
}

/**
 * El marco de esta pantalla es el de todas —`ui/Screen`—, con la vuelta al camino
 * arriba. Antes era un componente local, y el repaso tenía otro casi igual: dos
 * copias del mismo marco que ya se habían separado en el ancho y en el hueco bajo
 * el título.
 */
function Marco({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Screen title={titulo} back={{ href: '/aprender', label: 'Camino' }} ancho="lectura">
      {children}
    </Screen>
  );
}

/** La pantalla de después, centrada y sin nada alrededor. */
function Siguiente({
  celebration,
  progress,
  day,
  onNext,
}: {
  readonly celebration: Celebration;
  readonly progress: Parameters<typeof UnitDone>[0]['progress'];
  readonly day: string | null;
  readonly onNext: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <UnitDone
        celebration={celebration}
        progress={progress}
        day={day}
        nextLabel="Seguir"
        onNext={onNext}
      />
      <p className="pb-6 text-center">
        <Link href="/aprender" className="text-text-muted hover:text-text text-base">
          Volver al camino
        </Link>
      </p>
    </div>
  );
}
