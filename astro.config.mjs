import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'hybrid',   // static pages + serverless API routes
  adapter: vercel(),
  site: 'https://oneearthgifting.com',
  vite: {
    server: {
      allowedHosts: 'all',
    },
  },
});
