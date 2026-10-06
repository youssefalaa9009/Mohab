import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = fileURLToPath(new URL("./src", import.meta.url));

/**
 * Three builds share this config (entry and outDir come from the CLI):
 *   vite build --outDir dist/client                           browser bundle + manifest
 *   vite build --ssr src/entry.server.tsx --outDir dist/server  React SSR renderer
 *   vite build --ssr server/index.ts     --outDir dist/node     Fastify server
 *
 * There is no index.html: the document is rendered by React (src/document.tsx)
 * so React 19 hoists <title>/<meta>/<link> into <head> during SSR.
 */
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": src },
  },
  build: {
    emptyOutDir: true,
    sourcemap: true,
    manifest: !isSsrBuild,
    ...(isSsrBuild ? {} : { rollupOptions: { input: "src/entry.client.tsx" } }),
  },
  server: {
    // Fastify owns the HTTP port; Vite runs as middleware inside it.
    middlewareMode: true,
    // Any Cloudflare quick tunnel (hostnames only; the leading dot allows subdomains).
    allowedHosts: [".trycloudflare.com"],
  },
  optimizeDeps: {
    /*
     * There is no index.html for Vite's dependency scanner to crawl, so without
     * this it would only discover packages when a lazy route first imports
     * them, re-bundle mid-session, and leave the page holding two copies of
     * React ("Invalid hook call"). Scanning the whole source tree up front
     * finds every dependency before the first request.
     */
    entries: ["src/**/*.{ts,tsx}"],
  },
  appType: "custom",
}));
