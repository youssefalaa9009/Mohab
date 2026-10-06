import { useLocation } from "react-router";
import { site } from "@/config/site";
import { useRootData } from "@/root";

type MetaProps = {
  title: string;
  description?: string | null | undefined;
  /** Exclude from search results (filtered views, account pages, errors). */
  noindex?: boolean;
  /** Canonical path; defaults to the current path without its query string. */
  canonicalPath?: string;
  image?: string | null | undefined;
  type?: "website" | "product";
};

/**
 * Page metadata. React 19 hoists these elements into <head>, both during SSR
 * and on client navigation, so each page simply renders its own.
 */
export function Meta({
  title,
  description,
  noindex = false,
  canonicalPath,
  image,
  type = "website",
}: MetaProps) {
  const { siteUrl } = useRootData();
  const { pathname } = useLocation();
  const fullTitle = title === site.name ? site.name : `${title} · ${site.name}`;
  const canonical = `${siteUrl}${canonicalPath ?? pathname}`;
  const text = description ?? site.description;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={text} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={text} />
      <meta property="og:url" content={canonical} />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
    </>
  );
}

/**
 * Structured data for search engines. `<` is escaped so product text can never
 * close the script element early.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function breadcrumbJsonLd(siteUrl: string, crumbs: { label: string; to: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: `${siteUrl}${crumb.to}`,
    })),
  };
}
