import type { ReactNode } from "react";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { site } from "@/config/site";
import type { HomeData } from "@/features/catalog/types";
import { apiGet } from "@/lib/api";
import { JsonLd, Meta } from "@/lib/seo";
import { useRootData } from "@/root";
import { Constellation } from "./Manifesto";
import { Hero } from "./Hero";
import {
  CategoryTiles,
  CollectionsTeaser,
  EditorialStory,
  FeaturedSection,
  ProductRail,
} from "./sections";

export async function homeLoader(args: LoaderFunctionArgs) {
  return apiGet<HomeData>(args, "/api/catalog/home");
}

export function HomePage() {
  const home = useLoaderData() as HomeData;
  const { siteUrl } = useRootData();
  const firstCollection = home.collections[0];

  // Sections only render when they have real content, so numbers are assigned
  // to whatever actually appears — never "01, 03, 04".
  // `unnumbered` sections (interludes) don't take a number.
  const sections: { key: string; render: (number: string) => ReactNode; unnumbered?: true }[] = [];
  if (home.newArrivals.length) {
    sections.push({
      key: "new",
      render: (number) => (
        <ProductRail
          number={number}
          title="New arrivals"
          products={home.newArrivals}
          viewAllHref="/new-arrivals"
        />
      ),
    });
  }
  if (home.featured.length) {
    sections.push({
      key: "featured",
      render: (number) => <FeaturedSection number={number} products={home.featured} />,
    });
  }
  sections.push({ key: "story", render: (number) => <EditorialStory number={number} /> });
  sections.push({ key: "energies", render: () => <Constellation />, unnumbered: true });
  if (home.categories.length) {
    sections.push({
      key: "categories",
      render: (number) => <CategoryTiles number={number} categories={home.categories} />,
    });
  }
  // Best sellers come from confirmed orders only; hidden until there are some.
  if (home.bestSellers.length) {
    sections.push({
      key: "best",
      render: (number) => (
        <ProductRail
          number={number}
          title="Best sellers"
          products={home.bestSellers}
          viewAllHref="/shop?sort=best-selling"
        />
      ),
    });
  }
  if (home.collections.length) {
    sections.push({
      key: "collections",
      render: (number) => <CollectionsTeaser number={number} collections={home.collections} />,
    });
  }

  let count = 0;
  return (
    <main id="main" className="flex-1">
      <Meta title={site.name} description={site.description} canonicalPath="/" />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          url: siteUrl,
        }}
      />

      <Hero shopHref={firstCollection ? `/collections/${firstCollection.slug}` : "/shop"} />

      {sections.map((section) => {
        if (!section.unnumbered) count++;
        return <div key={section.key}>{section.render(String(count).padStart(2, "0"))}</div>;
      })}
    </main>
  );
}
