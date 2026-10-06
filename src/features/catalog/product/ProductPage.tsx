import { Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Link,
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { site } from "@/config/site";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/cn";
import { JsonLd, Meta, breadcrumbJsonLd } from "@/lib/seo";
import { useHydrated } from "@/hooks/useHydrated";
import { useRootData } from "@/root";
import { ProductGrid } from "../components/ProductCard";
import { Price } from "../components/Price";
import type { ImageRef, ProductDetail, VariantInfo } from "../types";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { AddToBag } from "./AddToBag";
import { ProductGallery } from "./ProductGallery";
import { useRecentlyViewed } from "./recently-viewed";
import { SizeGuide } from "./SizeGuide";

const MAX_QUANTITY = 10;

export async function productLoader(args: LoaderFunctionArgs) {
  const slug = args.params.slug!;
  return apiGet<ProductDetail>(args, `/api/catalog/products/${encodeURIComponent(slug)}`);
}

/** Choosing a colour only changes ?color= — the product itself is already loaded. */
export function productShouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return currentUrl.pathname !== nextUrl.pathname && defaultShouldRevalidate;
}

export function ProductPage() {
  const product = useLoaderData() as ProductDetail;
  // Remount per product so size/quantity never carry over between pages.
  return <ProductView key={product.id} product={product} />;
}

function ProductView({ product }: { product: ProductDetail }) {
  const { siteUrl, mediaUrl } = useRootData();
  const [params, setParams] = useSearchParams();
  // Colour and size are controlled inputs: a choice made before hydration would
  // be reset by React and silently lost, so they wait until the page is live.
  const hydrated = useHydrated();

  const colors = product.colorDetails;
  const color = colors.find((item) => item.slug === params.get("color")) ?? colors[0] ?? null;
  const oneSize = product.sizes.length === 0;
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const variantsForColor = product.variants.filter(
    (variant) => variant.colorSlug === (color?.slug ?? null),
  );
  const variant: VariantInfo | null = oneSize
    ? (variantsForColor[0] ?? null)
    : (variantsForColor.find((item) => item.size === size) ?? null);

  const images: ImageRef[] = [...(color?.images ?? []), ...product.sharedImages];
  const galleryImages = images.length ? images : product.primaryImage ? [product.primaryImage] : [];

  const selectColor = (slug: string) => {
    const next = new URLSearchParams(params);
    if (slug === colors[0]?.slug) next.delete("color");
    else next.set("color", slug);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const displayPrice = variant?.price ?? product.price;
  const displayCompareAt = variant ? variant.compareAtPrice : product.compareAtPrice;

  const crumbs: Crumb[] = [
    { label: "Home", to: "/" },
    { label: "Shop", to: "/shop" },
    { label: product.category.name, to: `/shop/${product.category.slug}` },
    { label: product.name, to: `/products/${product.slug}` },
  ];

  const recentlyViewed = useRecentlyViewed(product.slug);

  return (
    <main id="main" className="flex-1">
      <Meta
        title={product.seoTitle ?? product.name}
        description={product.seoDescription ?? product.description}
        type="product"
        canonicalPath={`/products/${product.slug}`}
        image={realImageUrl(mediaUrl, product.primaryImage)}
      />
      <JsonLd data={productJsonLd(product, siteUrl, mediaUrl)} />
      <JsonLd data={breadcrumbJsonLd(siteUrl, crumbs)} />

      <div className="container-page pt-6 lg:pt-10">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <div className="grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 lg:col-span-7">
            <ProductGallery images={galleryImages} productName={product.name} />
          </div>

          <div className="col-span-4 md:col-span-8 lg:col-span-5">
            <div className="flex flex-col gap-8 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {product.soldOut && <Badge tone="soldOut">Sold out</Badge>}
                  {!product.soldOut && product.isNew && <Badge>New</Badge>}
                  {!product.soldOut && displayCompareAt && <Badge tone="sale">Sale</Badge>}
                </div>
                <h1 className="mt-4 font-display text-h1">{product.name}</h1>
                <Price
                  price={displayPrice}
                  compareAtPrice={displayCompareAt}
                  className="mt-4 text-h3"
                />
              </div>

              {colors.length > 0 && (
                <fieldset disabled={!hydrated}>
                  <legend className="label-caps text-muted">
                    Colour — <span className="text-ink">{color?.name}</span>
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {colors.map((item) => (
                      <label
                        key={item.slug}
                        title={item.name}
                        className="relative flex size-11 cursor-pointer items-center justify-center"
                      >
                        <input
                          type="radio"
                          name="color"
                          value={item.slug}
                          checked={item.slug === color?.slug}
                          onChange={() => selectColor(item.slug)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className="size-8 rounded-full border border-line-strong ring-offset-2 ring-offset-canvas transition-shadow peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--focus-ring)]"
                          style={{ backgroundColor: item.hex ?? "transparent" }}
                        />
                        <span className="sr-only">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {!oneSize && (
                <fieldset disabled={!hydrated}>
                  <div className="flex items-center justify-between">
                    <legend className="label-caps text-muted">
                      Size{size && <span className="text-ink"> — {size}</span>}
                    </legend>
                    {product.sizeChart && <SizeGuide chart={product.sizeChart} />}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {product.sizes.map((item) => {
                      const option = variantsForColor.find((entry) => entry.size === item);
                      const unavailable = !option || option.stock === "out";
                      return (
                        <label key={item} className="relative">
                          <input
                            type="radio"
                            name="size"
                            value={item}
                            checked={size === item}
                            disabled={unavailable}
                            onChange={() => setSize(item)}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "flex h-12 cursor-pointer items-center justify-center border label-caps transition-colors",
                              "border-line-strong peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper",
                              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]",
                              "peer-disabled:cursor-not-allowed peer-disabled:text-muted peer-disabled:line-through",
                              !unavailable && "hover:border-ink",
                            )}
                          >
                            {item}
                          </span>
                          {unavailable && <span className="sr-only">, sold out</span>}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <StockNote
                variant={variant}
                needsSize={!oneSize && !size}
                soldOut={product.soldOut}
              />

              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <QuantityStepper
                    value={quantity}
                    onChange={setQuantity}
                    max={MAX_QUANTITY}
                    disabled={product.soldOut || !hydrated}
                  />
                  <AddToBag
                    className="flex-1"
                    variant={variant}
                    quantity={quantity}
                    needsSize={!oneSize && !size}
                    soldOut={product.soldOut}
                  />
                  <WishlistButton
                    productId={product.id}
                    productName={product.name}
                    variant="outline"
                  />
                </div>
                <AddToBag
                  buyNow
                  variant={variant}
                  quantity={quantity}
                  needsSize={!oneSize && !size}
                  soldOut={product.soldOut}
                />
              </div>

              <ul className="flex flex-col gap-2 border-y border-line py-5 text-small">
                {site.paymentMethods.map((method) => (
                  <li key={method}>{method} available</li>
                ))}
                <li className="text-muted">{site.policies.shippingSummary}</li>
                <li className="text-muted">{site.policies.returnsSummary}</li>
              </ul>

              <Accordion multiple defaultValue={["description"]}>
                {/* Sections without content (an incomplete product) are left out, never shown empty. */}
                {product.description && (
                  <AccordionItem value="description" title="Description">
                    <Paragraphs text={product.description} />
                  </AccordionItem>
                )}
                {(product.material || product.care) && (
                  <AccordionItem value="materials" title="Materials &amp; care">
                    <dl className="flex flex-col gap-3">
                      {product.material && <Detail label="Material">{product.material}</Detail>}
                      {product.care && <Detail label="Care">{product.care}</Detail>}
                    </dl>
                  </AccordionItem>
                )}
                {product.fit && (
                  <AccordionItem value="fit" title="Fit">
                    <Paragraphs text={product.fit} />
                  </AccordionItem>
                )}
                <AccordionItem value="shipping" title="Shipping &amp; returns">
                  <p>{site.policies.shipping}</p>
                  <p className="mt-3">{site.policies.returns}</p>
                  <p className="mt-3">
                    <Link to="/help/returns" className="text-ink underline">
                      Returns &amp; exchanges
                    </Link>
                  </p>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      <Recommendations title="Complete the look" products={product.completeTheLook} />
      <Recommendations title="You may also like" products={product.related} />
      <Recommendations title="Recently viewed" products={recentlyViewed} />
    </main>
  );
}

function StockNote({
  variant,
  needsSize,
  soldOut,
}: {
  variant: VariantInfo | null;
  needsSize: boolean;
  soldOut: boolean;
}) {
  let message: string | null = null;
  let tone = "text-muted";
  if (soldOut) message = "This item is sold out.";
  else if (needsSize) message = null;
  else if (variant?.stock === "out") message = "Sold out in this size.";
  else if (variant?.stock === "low") {
    message = "Low stock — only a few left.";
    tone = "text-warning";
  } else if (variant?.stock === "in") message = "In stock.";
  return (
    <p className={cn("min-h-6 text-small", tone)} aria-live="polite">
      {message}
    </p>
  );
}

function QuantityStepper({
  value,
  onChange,
  max,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex h-12 items-center border border-line-strong"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        aria-label="Decrease quantity"
        className="inline-flex size-11 items-center justify-center disabled:opacity-30"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <output aria-live="polite" className="w-8 text-center tabular-nums">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className="inline-flex size-11 items-center justify-center disabled:opacity-30"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label-caps text-ink">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

function Recommendations({
  title,
  products,
}: {
  title: string;
  products: ProductDetail["related"];
}) {
  if (!products.length) return null;
  const headingId = `rec-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="container-page mt-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-8 font-display text-h2">
        {title}
      </h2>
      <ProductGrid products={products} />
    </section>
  );
}

function realImageUrl(mediaUrl: string | null, image: ImageRef | null) {
  if (!mediaUrl || !image || image.key.startsWith("placeholder:")) return null;
  return `${mediaUrl}/${image.key}`;
}

/** schema.org Product. Only facts from the catalog — no invented ratings or reviews. */
function productJsonLd(product: ProductDetail, siteUrl: string, mediaUrl: string | null) {
  const images = [...product.colorDetails.flatMap((color) => color.images), ...product.sharedImages]
    .map((image) => realImageUrl(mediaUrl, image))
    .filter((url) => url !== null);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length ? { image: images } : {}),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: product.price.currency,
      price: (product.price.amount / 100).toFixed(2),
      availability: product.soldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
