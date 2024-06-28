import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [basicSsl()],
  root: 'src',
  publicDir: '../public',
  base: './',
  server: {
    host: true
  },
  build: {
    outDir: '../dist'
  }
});
