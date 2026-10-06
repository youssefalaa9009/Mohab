import type { ReactNode } from "react";

/** Script/stylesheet URLs for the current build, resolved by the server. */
export type Assets = {
  /** Browser entry module. */
  entry: string;
  /** Stylesheets to load in <head> (empty in dev — Vite injects them). */
  css: string[];
  /** Modules to preload alongside the entry. */
  preload: string[];
  /** Font files every page needs, preloaded so text paints in the right face sooner. */
  fonts: string[];
  dev: boolean;
};

/**
 * React Fast Refresh preamble. In dev the browser loads modules straight from
 * Vite, so the runtime must be installed before any component module evaluates.
 * This is what Vite's `transformIndexHtml` injects for an HTML-entry app; we
 * render the document ourselves, so we emit it ourselves.
 */
const REFRESH_PREAMBLE = `import RefreshRuntime from "/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;`;

type DocumentProps = {
  assets: Assets;
  lang: string;
  dir: "ltr" | "rtl";
  /** Content-Security-Policy nonce. Set in production; absent in dev, where CSP is off. */
  nonce?: string | undefined;
  analytics?: { scriptUrl: string; websiteId: string } | null;
  children: ReactNode;
};

export function Document({ assets, lang, dir, nonce, analytics, children }: DocumentProps) {
  return (
    <html lang={lang} dir={dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {assets.fonts.map((href) => (
          // Fonts are fetched in CORS mode, so the preload must be too or it's wasted.
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        {assets.css.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {assets.preload.map((href) => (
          <link key={href} rel="modulepreload" href={href} />
        ))}
        {assets.dev && (
          <>
            <script
              type="module"
              nonce={nonce}
              dangerouslySetInnerHTML={{ __html: REFRESH_PREAMBLE }}
            />
            <script type="module" nonce={nonce} src="/@vite/client" />
          </>
        )}
        {/*
          Scroll reveals are server-rendered in their hidden state. Without
          JavaScript they would never animate in, so make them visible instead
          of leaving the page blank.
        */}
        <noscript>
          <style nonce={nonce}>
            {"[data-reveal]{opacity:1!important;transform:none!important}"}
          </style>
        </noscript>
        {/* Module scripts are deferred, so this runs after the body is parsed. */}
        <script type="module" nonce={nonce} src={assets.entry} />
        {analytics && (
          // Cookieless; honours Do Not Track. Events go through src/lib/analytics.ts.
          <script
            defer
            nonce={nonce}
            src={analytics.scriptUrl}
            data-website-id={analytics.websiteId}
            data-do-not-track="true"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
