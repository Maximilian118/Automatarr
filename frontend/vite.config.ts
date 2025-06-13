import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 8090,
    strictPort: true,
    host: "0.0.0.0", // Listen on all interfaces
    proxy: {
      "/graphql": {
        target: "http://localhost:8091",
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern", // Use the modern API for Sass
      },
    },
  },
})
