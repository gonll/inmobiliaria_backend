import type { Config } from 'kubb';

const config: Config = {
  root: '.',
  input: {
    path: './openapi.json',
  },
  output: {
    path: './sdk',
    clean: true,
  },
  plugins: [
    [
      '@kubb/swagger',
      {
        validate: true,
      },
    ],
  ],
};

export default config;

