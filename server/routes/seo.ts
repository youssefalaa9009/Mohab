import type { FastifyInstance } from "fastify";
import { navData, sitemapEntries } from "../catalog/repository.js";
import { serverEnv } from "../env.js";

/** Pages that exist regardless of catalog data. Extended as content pages ship. */
const STATIC_PATHS = [
  "/",
  "/shop",
  "/new-arrivals",
  "/collections",
  "/about",
  "/contact",
  "/faq",
  "/help/shipping",
  "/help/returns",
  "/help/track-order",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
];

/** Areas crawlers have no business in: private, transactional or internal. */
const DISALLOWED = [
  "/api/",
  "/account",
  "/cart",
  "/checkout",
  "/admin",
  "/wishlist",
  "/newsletter/",
  "/design",
];

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function seoRoutes(app: FastifyInstance) {
  app.get("/robots.txt", async (_request, reply) => {
    const { SITE_URL } = serverEnv();
    const body = [
      "User-agent: *",
      ...DISALLOWED.map((path) => `Disallow: ${path}`),
      "",
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      "",
    ].join("\n");
    return reply
      .type("text/plain; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(body);
  });

  app.get("/sitemap.xml", async (_request, reply) => {
    const { SITE_URL } = serverEnv();
    const [entries, nav] = await Promise.all([sitemapEntries(), navData()]);

    const urls: { path: string; lastmod?: Date }[] = [
      ...STATIC_PATHS.map((path) => ({ path })),
      ...nav.genders.map((gender) => ({ path: `/${gender}` })),
      ...entries.categories.map((category) => ({ path: `/shop/${category.slug}` })),
      ...entries.collections.map((collection) => ({ path: `/collections/${collection.slug}` })),
      ...entries.products.map((product) => ({
        path: `/products/${product.slug}`,
        lastmod: product.updatedAt,
      })),
    ];

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map(
          ({ path, lastmod }) =>
            `  <url><loc>${escapeXml(SITE_URL + path)}</loc>` +
            (lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : "") +
            "</url>",
        )
        .join("\n") +
      "\n</urlset>\n";

    return reply
      .type("application/xml; charset=utf-8")
      .header("cache-control", "public, max-age=900")
      .send(body);
  });
}
