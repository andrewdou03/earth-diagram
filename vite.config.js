import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from "vite-plugin-glsl";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    glsl({
      include: "**/*.glsl", // or .vert/.frag
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        embed: resolve(__dirname, 'embed.html'),
      },
    },
  }
});
