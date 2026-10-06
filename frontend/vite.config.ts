import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { version } from "./package.json"

export default defineConfig({
  base: "/",
  plugins: [react()],
  // The app version from package.json, shown in the footer
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port: 8090,
    strictPort: true,
    host: "0.0.0.0", // Listen on all interfaces
    proxy: {
      "/graphql": {
        target: "http://localhost:8091",
        changeOrigin: true,
      },
      "/api": {
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
