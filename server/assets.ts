import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Assets } from "../src/document.js";

const CLIENT_ENTRY = "src/entry.client.tsx";

type ManifestChunk = {
  file: string;
  css?: string[];
  imports?: string[];
  assets?: string[];
};

/**
 * Fonts every page renders with (Latin body and display). Preloading them lets
 * text paint in the right face sooner; other subsets load only when used.
 */
const CRITICAL_FONTS = [/instrument-serif-latin-400-normal-/, /instrument-sans-latin-wdth-normal-/];

/**
 * Stylesheets linked into dev-mode HTML so the first paint is styled.
 * In dev, Vite delivers CSS by injecting it from JavaScript, which would leave
 * a flash of raw HTML until the scripts load. Vite also serves these files as
 * plain CSS when a <link> asks for them.
 */
export const DEV_STYLESHEETS = ["/src/styles/globals.css"];

/** Dev: the browser loads source straight from Vite, which also injects the CSS. */
export function devAssets(): Assets {
  return { entry: `/${CLIENT_ENTRY}`, css: [], preload: [], fonts: [], dev: true };
}

/**
 * Production: resolve hashed URLs from the Vite manifest so the document can
 * preload the entry's static imports and load CSS before first paint.
 */
export async function loadProductionAssets(clientDir: string): Promise<Assets> {
  const manifestPath = path.join(clientDir, ".vite", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
    string,
    ManifestChunk
  >;

  const entry = manifest[CLIENT_ENTRY];
  if (!entry) {
    throw new Error(`Client entry "${CLIENT_ENTRY}" missing from ${manifestPath}`);
  }

  const css = new Set<string>();
  const preload = new Set<string>();

  // Walk static imports so every stylesheet in the entry graph is in <head>.
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    for (const href of chunk.css ?? []) css.add(`/${href}`);
    for (const next of chunk.imports ?? []) {
      const imported = manifest[next];
      if (imported) preload.add(`/${imported.file}`);
      visit(next);
    }
  };
  visit(CLIENT_ENTRY);

  return {
    entry: `/${entry.file}`,
    css: [...css],
    preload: [...preload],
    fonts: (entry.assets ?? [])
      .filter((file) => CRITICAL_FONTS.some((pattern) => pattern.test(file)))
      .map((file) => `/${file}`),
    dev: false,
  };
}
