import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { apiGet } from "@/lib/api";
import { JsonLd, Meta, breadcrumbJsonLd } from "@/lib/seo";
import { useRootData } from "@/root";
import { ProductImage } from "../components/ProductImage";
import type { CollectionSummary } from "../types";

export async function collectionsLoader(args: LoaderFunctionArgs) {
  return apiGet<CollectionSummary[]>(args, "/api/catalog/collections");
}

const crumbs: Crumb[] = [
  { label: "Home", to: "/" },
  { label: "Collections", to: "/collections" },
];

export function CollectionsPage() {
  const collections = useLoaderData() as CollectionSummary[];
  const { siteUrl } = useRootData();

  return (
    <main id="main" className="flex-1">
      <Meta title="Collections" />
      <JsonLd data={breadcrumbJsonLd(siteUrl, crumbs)} />

      <header className="container-page pt-8 pb-12 lg:pt-12 lg:pb-16">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="mt-8 font-display text-h1">Collections</h1>
      </header>

      <div className="container-page pb-section">
        {collections.length === 0 ? (
          <p className="border border-line px-6 py-20 text-center text-muted">
            No collections are live right now.
          </p>
        ) : (
          <ul className="grid gap-x-gutter gap-y-16 md:grid-cols-2">
            {collections.map((collection, index) => (
              <li key={collection.slug}>
                <Reveal delay={(index % 2) * 0.08}>
                  <Link to={`/collections/${collection.slug}`} className="group block">
                    <div className="aspect-[4/5] overflow-hidden">
                      <ProductImage
                        image={{
                          key: collection.heroImageKey ?? `placeholder:${(index + 2) % 4}`,
                          alt: "",
                          width: 1600,
                          height: 2000,
                        }}
                        decorative
                        priority={index < 2}
                        sizes="(min-width: 48rem) 50vw, 100vw"
                        className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    </div>
                    <div className="mt-5 flex items-baseline justify-between gap-4">
                      <h2 className="font-display text-h2">{collection.name}</h2>
                      <span className="label-caps text-muted">
                        N°{String(index + 1).padStart(2, "0")} · {collection.productCount}{" "}
                        {collection.productCount === 1 ? "piece" : "pieces"}
                      </span>
                    </div>
                    {collection.description && (
                      <p className="mt-3 max-w-[52ch] text-muted">{collection.description}</p>
                    )}
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
