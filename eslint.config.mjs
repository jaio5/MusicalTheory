import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'reference/**'],
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
              group: ['@features/*/*'],
              message:
                'Un feature no importa de otro feature. Lo compartido sube a core/, ui/ o state/.',
            },
          ],
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
