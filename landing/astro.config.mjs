import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://codexa-toolkit.dev',
  output: 'static',
  build: {
    format: 'directory'
  }
});
