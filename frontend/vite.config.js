import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const target =
    loadEnv(mode, process.cwd(), "").API_PROXY_TARGET ||
    "http://127.0.0.1:5000";
  return {
    plugins: [react(), tailwind()],
    resolve: {
      alias: {
        "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
      proxy: Object.fromEntries(
        ["/api", "/media", "/robots.txt", "/sitemap.xml"].map((path) => [
          path,
          { target },
        ]),
      ),
    },
  };
});
