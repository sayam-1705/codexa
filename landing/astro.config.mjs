import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://codexa.dev',
  output: 'static',
  build: {
    format: 'directory'
  }
});
