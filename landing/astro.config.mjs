import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://codexa-toolkit.vercel.app',
  output: 'static',
  build: {
    format: 'directory'
  }
});
