import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://codexa-cli.dev',
  output: 'static',
  build: {
    format: 'directory'
  }
});
