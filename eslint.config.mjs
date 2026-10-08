import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.claude/worktrees/**',
      'coverage/**',
      'next-env.d.ts',
      'reference/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    // Regla 1 de ARCHITECTURE.md: el dominio no conoce el navegador ni las
    // capas de arriba. Si un import de core/ apunta fuera de core/, la pieza
    // está en el sitio equivocado.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@audio/*',
                '@media/*',
                '@server/*',
                '@state/*',
                '@features/*',
                '@ui/*',
                '@/app/*',
              ],
              message: 'src/core/ no puede importar de otras capas: es TypeScript puro.',
            },
          ],
        },
      ],
    },
  },
  {
    // Regla 3: un feature no importa de otro feature.
    // Regla 5: la capa de servidor solo la abre app/.
    //
    // Las dos en el mismo bloque porque `no-restricted-imports` no se acumula:
    // el último bloque que la configure para un fichero gana, así que separarlas
    // dejaría una de las dos apagada sin que se note.
    //
    // Es la regla que evita el accidente más caro del proyecto: un import de
    // @server/ desde un componente arrastra el cliente de Postgres, Auth.js y
    // —peor— la clave de la base de datos al bundle del navegador. Next avisa de
    // algunos de estos casos al construir; esto avisa antes, en el editor, y
    // también de los que Next deja pasar.
    files: ['src/features/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@server/*', '@/server/*'],
              message:
                'Solo app/ abre src/server/. Lo que haga falta abajo se pasa por props o se pide por fetch a una ruta.',
            },
            {
              // Sin la forma de un solo tramo, `@features/recorder` —el índice—
              // se colaba: `@features/*/*` exige dos, y el índice es donde
              // primero se busca al importar de otro feature.
              group: ['@features/*'],
              message:
                'Un feature no importa de otro feature. Lo compartido sube a core/, ui/ o state/.',
            },
          ],
        },
      ],
    },
  },
  {
    // Regla 3 y adr/0079: el micrófono es uno, y lo abre `state/use-listening.ts`
    // cargando los motores con `import()` solo cuando hace falta. Un componente
    // que importe la entrada o un motor abre un segundo camino al micro y,
    // además, arrastra el análisis entero al paquete de pantallas que no
    // escuchan. Los tipos sí: no viajan al navegador ni abren nada.
    //
    // Es la versión de typescript-eslint, y no la de ESLint, por `allowTypeImports`.
    // Al ser otra regla no pisa la `no-restricted-imports` del bloque de arriba.
    files: ['src/features/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@audio/web-audio-input',
                '@audio/autocorrelation-pitch-engine',
                '@audio/chord-engine',
                '**/audio/web-audio-input',
                '**/audio/autocorrelation-pitch-engine',
                '**/audio/chord-engine',
              ],
              allowTypeImports: true,
              message:
                'El micrófono lo abre state/use-listening.ts (adr/0079): pídelo con useListening. Los tipos, con import type.',
            },
          ],
        },
      ],
    },
  },
  {
    // Un ciclo de imports es un módulo que se evalúa a medias: lo de arriba de uno
    // ve `undefined` en lo del otro según quién entre primero, y el fallo sale en
    // producción y no en el test que importa en otro orden. Los imports de solo
    // tipos no cuentan —desaparecen al compilar—, y la regla ya los salta.
    //
    // `disableScc`: el atajo de componentes conexos lee el fichero del disco, y
    // revienta con los que no existen, que es como `capas.test.ts` comprueba las
    // reglas. Sin él, además, `pnpm lint` tarda menos.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'import/no-cycle': ['error', { disableScc: true }],
    },
  },
  {
    // ui/ son piezas: no abren el micro ni leen el estado de la sesión. Las que sí
    // lo hacen —las «piezas conectadas»— son tres, con nombre, y no se añade otra
    // sin pasar por adr/0124: un `ui/` que lee el store deja de poder montarse en
    // cualquier sitio, que es para lo que existe.
    //
    // Con `no-restricted-syntax` y no con `no-restricted-imports`, porque esa ya la
    // configura para ui/ el bloque de las reglas 3 y 5, y no se acumula: un bloque
    // más con ella apagaría aquella. Los tipos pasan: no conectan nada.
    files: ['src/ui/**/*.{ts,tsx}'],
    ignores: [
      'src/ui/EmpezarPorTonalidad.tsx',
      'src/ui/CupoDeIA.tsx',
      'src/ui/ThemeToggle.tsx',
      'src/ui/**/*.test.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[importKind!='type'][source.value=/^@(state|audio|media)\\u002F/], ImportExpression[source.value=/^@(state|audio|media)\\u002F/]",
          message:
            'ui/ no lee el estado ni abre el micro: pásalo por props desde quien lo monta. Las piezas conectadas son tres y tienen nombre (adr/0124).',
        },
      ],
    },
  },
  {
    // Y al revés: el servidor no importa de las capas del navegador. Lo que
    // comparten vive en core/, que las dos pueden usar.
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@audio/*', '@media/*', '@state/*', '@features/*', '@ui/*', '@/app/*'],
              message:
                'src/server/ no importa del navegador. Lo compartido con el cliente sube a core/.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
