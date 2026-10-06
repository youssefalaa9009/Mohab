import { cn } from "@/lib/cn";

/**
 * Loading placeholders in the shape of what's coming. Hidden from assistive
 * tech: the surrounding region announces loading once (aria-busy).
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden className={cn("skeleton", className)} style={style} />;
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[4/5]" />
      <div className="mt-3 flex justify-between gap-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="mt-3 size-5 rounded-full" />
    </div>
  );
}

export function ProductGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid grid-cols-2 gap-x-gutter gap-y-10 md:grid-cols-3 lg:gap-y-14 xl:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Skeletons for a page that is still loading, chosen by its URL. */
export function PageSkeleton({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/products/")) {
    return (
      <div role="status" aria-busy className="container-page flex-1 pt-8 pb-section lg:pt-12">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-3 w-48" />
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <Skeleton className="aspect-[4/5] lg:col-span-7" />
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-16 w-4/5" />
            <Skeleton className="h-6 w-28" />
            <div className="mt-6 flex gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="size-10 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
            <Skeleton className="mt-6 h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </div>
    );
  }

  const listing = /^\/(shop|men|women|new-arrivals|collections\/|search|wishlist)/.test(pathname);
  return (
    <div role="status" aria-busy className="container-page flex-1 pt-8 pb-section lg:pt-12">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-8 h-14 w-72 max-w-full" />
      {listing ? (
        <ProductGridSkeleton className="mt-14" />
      ) : (
        <div className="mt-12 flex max-w-[68ch] flex-col gap-3">
          {[100, 96, 88, 92, 70].map((width, index) => (
            <Skeleton key={index} className="h-4" style={{ width: `${width}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
