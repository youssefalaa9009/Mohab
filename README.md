# QUATTRO

Storefront for the QUATTRO clothing brand. Node.js + React, server-rendered, self-hosted.

> **Placeholders are deliberate.** Anything in `[SQUARE BRACKETS]` is business
> information QUATTRO has not supplied yet (prices, policies, contact details,
> brand copy). Never replace one with invented content.

## Stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Server     | Node 22 + Fastify 5 — HTTP, API, SSR, static assets |
| UI         | React 19 + React Router 7 (data mode, custom SSR)   |
| Build      | Vite 8 (Rolldown)                                   |
| Styling    | Tailwind v4, tokens in `src/styles/globals.css`     |
| Components | Base UI primitives, restyled in `src/components/ui` |
| Motion     | Motion (`m` components, lazily loaded)              |
| Data       | PostgreSQL + Drizzle ORM                            |
| Deployment | Docker Compose on a VPS, Caddy for TLS              |

There is no `index.html`: React renders the whole document (`src/document.tsx`)
so React 19 hoists `<title>`/`<meta>` into `<head>` during SSR.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev:all        # database + site → http://localhost:3000
```

`dev:all` starts a project-local PostgreSQL (port 5433, data in `.postgres/`) and
the site together. The first run creates the database, applies migrations and
seeds 12 clearly-labelled demo products. Later runs reuse the data and apply any
new migrations. `npm run db:start -- --reset` wipes it and starts over.

This database is disposable and separate from production, which runs its own
PostgreSQL in Docker. `/design` renders the living design system.

Create a staff account for the admin at `/admin` (the password is prompted for,
or read from `ADMIN_PASSWORD`):

```bash
npm run admin:create -- --email you@example.com --name "Your Name"
```

## Scripts

| Script                 | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Fastify with Vite in middleware mode (HMR)                |
| `npm run build`        | Client bundle → SSR renderer → server bundle              |
| `npm start`            | Run the production build (`dist/`)                        |
| `npm run check`        | lint → format → types → schema → build                    |
| `npm run db:generate`  | Create a migration from the schema                        |
| `npm run db:migrate`   | Apply pending migrations                                  |
| `npm run db:seed`      | Seed demo data (`-- --clean` removes it)                  |
| `npm run db:check`     | Apply migrations + seed to in-memory Postgres (no server) |
| `npm run admin:create` | Create or promote a staff account                         |
| `npm run test:e2e`     | Playwright end-to-end suite (desktop + mobile)            |

## Layout

```
server/      Node only — Fastify, DB, env. Never imported by src/.
  app.ts     plugins, static assets, SSR catch-all
  routes/    HTTP API (catalog, cart, checkout, orders, account, wishlist, content, admin)
  catalog/ cart/ checkout/ admin/ commerce/ email/ media/   domain logic
  db/        Drizzle schema + client
src/         Browser + shared. Must stay isomorphic.
  document.tsx   the <html> shell
  entry.client   hydration (resolves lazy routes first)
  entry.server   React Router static handler → stream
  routes.tsx     shared route table
  components/    ui/ motion/ layout/
  features/      one folder per product area
scripts/     migrations, seeding, staff accounts, backups, review screenshots
tests/e2e/   Playwright specs
```

ESLint enforces the boundary: `src/` cannot import from `server/` or Node
built-ins. Route loaders talk to the Fastify API over HTTP so they run
unchanged on both sides.

## Conventions

- **Money** is stored as integer minor units (piastres) with a currency code. Never floats.
- **Orders snapshot** product names, prices and addresses, so later catalog edits never rewrite history.
- **"Best seller"** is derived from paid orders — never a manual flag.
- **Images** are 4:5 so grids never shift while loading.
- **Reveal animations** are server-rendered hidden. `[data-reveal]` is forced
  visible under `prefers-reduced-motion` and inside `<noscript>`, so content is
  never lost when the animation cannot run.
- **CSP** is strict in production: scripts run under a per-request nonce.

## Deployment

CI builds two images (`runner` = the app, `migrator` = migrations and one-off
tasks) and pushes them to GHCR. On the VPS, next to `docker-compose.yml`,
`Caddyfile` and `scripts/backup.sh`, create `.env` from `.env.example`
(at least `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `SITE_URL`, `SITE_DOMAIN`
and the two image names), then:

```bash
docker compose pull && docker compose up -d
# first time: a staff account
docker compose run --rm -it migrate npx tsx scripts/create-admin.ts --email you@example.com
```

- Migrations run as their own service and must succeed before the app starts.
- Caddy obtains TLS certificates for `SITE_DOMAIN` (ports 80/443 must be open).
  Behind Cloudflare's proxy use SSL mode "Full (strict)" and set `BEHIND_CLOUDFLARE=true`.
- Uploaded product photos live in the `uploads` volume; the database in `pgdata`.
- **Backups:** `scripts/backup.sh` dumps the database and archives uploads into
  `backups/` (cron example and restore commands inside). Copy them off the server.
- Email: without `RESEND_API_KEY`, receipts and password resets are only logged.
  Verify the sending domain in Resend and set `EMAIL_FROM` before launch.

## Before launch

The site ships with **example content** so it can be reviewed as it will look.
None of it is QUATTRO's real information. Replace all of it:

- **`src/config/site.ts`** — brand description, headline and story, announcement
  bar, contact details (`hello@quattro.example`, `+20 100 000 0000`), social
  links, shipping/returns/exchange/refund policies, and the hero, story and
  About photos (files in `public/images/site/`).
- **`src/features/content/ContentPages.tsx`** — About, FAQ and Returns copy, and
  the Privacy, Terms and Cookie pages (have these written or checked by a lawyer;
  the business name and commercial registration there are examples).
- **`server/email/templates.ts`** — the refund wording in the "returned" email.
- **Example catalog** — 12 products with example names, prices, copy and stock,
  example delivery rates (Standard EGP 85, free over EGP 2,000; Express in Cairo
  and Giza), a size chart, and category/collection photos. Add real products in
  the admin, then remove every example with `npm run db:seed -- --clean`.
- **Photos** — free-licence Unsplash stand-ins (credits in
  `scripts/example-media/CREDITS.md`; `npm run media:examples` re-fetches them).
  Replace with QUATTRO's own photography.
- InstaPay (optional): enter the payment address and account name in Admin → Payments.

## Status

Built: catalog and product pages, search, bag, checkout with **cash on delivery**
(confirmation call) or **InstaPay** (customer sends the transfer reference, staff
verify it in the admin; unpaid orders are cancelled automatically after a hold
time set in Admin → Payments), order tracking, order emails (receipt, confirmed,
shipped, delivered, cancelled, returned, payment not verified), customer accounts and
saved addresses, wishlist, admin (orders, payment review, products and photos,
discounts, delivery rates, categories and collections, customers, contact
messages, order and newsletter CSV exports, payment settings), signed newsletter
unsubscribe links (in the subscriber export, for your email tool), content and policy pages, SEO
(sitemap, robots, canonical and OG tags) and optional cookieless analytics
(Umami).

Quality gates: `npm run check` (lint, format, types, schema, build) and
`npm run test:e2e` — Playwright on desktop and mobile, including an axe-core
WCAG 2.1 AA audit of storefront, checkout and admin pages.

Not yet: Arabic translation (the app is RTL-ready: `lang`/`dir` come from the locale).
