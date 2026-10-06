import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { ProductImage } from "../components/ProductImage";
import type { ImageRef } from "../types";

/**
 * Desktop: an editorial grid of every photo (first one full width).
 * Mobile: a swipeable carousel with a position counter.
 * Either opens a full-screen viewer with zoom.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: ImageRef[];
  productName: string;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <>
      {/* Desktop grid */}
      <ul className="hidden grid-cols-2 gap-2 lg:grid">
        {images.map((image, index) => (
          <li
            key={`${image.key}-${index}`}
            // First photo full width; a leftover last photo also goes full width
            // instead of sitting alone in half a row.
            className={cn(
              (index === 0 || (index === images.length - 1 && index % 2 === 1)) && "col-span-2",
            )}
          >
            <button
              type="button"
              onClick={() => setViewerIndex(index)}
              aria-label={`View image ${index + 1} of ${images.length} full screen`}
              className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden"
            >
              <ProductImage
                image={image}
                priority={index === 0}
                sizes={
                  index === 0 ? "(min-width: 64rem) 58vw, 100vw" : "(min-width: 64rem) 29vw, 50vw"
                }
              />
              <ZoomIn
                aria-hidden
                className="absolute end-4 top-4 size-5 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>

      {/* Mobile carousel — remounted per image set, so a new colour starts at its first photo. */}
      <MobileCarousel
        key={images.map((image) => image.key).join("|")}
        images={images}
        onOpen={setViewerIndex}
      />

      <Viewer
        images={images}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        productName={productName}
      />
    </>
  );
}

function MobileCarousel({
  images,
  onOpen,
}: {
  images: ImageRef[];
  onOpen: (index: number) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <div
      className="-mx-gutter lg:hidden"
      aria-roledescription="carousel"
      aria-label="Product images"
    >
      <div ref={emblaRef} className="overflow-hidden">
        <ul className="flex touch-pan-y">
          {images.map((image, index) => (
            <li
              key={`${image.key}-${index}`}
              className="min-w-0 flex-[0_0_88%] ps-2 first:ps-gutter last:pe-gutter"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${images.length}`}
            >
              <button
                type="button"
                onClick={() => onOpen(index)}
                className="block aspect-[4/5] w-full"
                aria-label={`View image ${index + 1} full screen`}
              >
                <ProductImage image={image} priority={index === 0} sizes="88vw" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {images.length > 1 && (
        <p className="mt-3 px-gutter label-caps text-muted tabular-nums" aria-live="polite">
          {selected + 1} / {images.length}
        </p>
      )}
    </div>
  );
}

function Viewer({
  images,
  index,
  onIndexChange,
  productName,
}: {
  images: ImageRef[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  productName: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const open = index !== null;
  const current = index ?? 0;

  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      onIndexChange((current + delta + images.length) % images.length);
    },
    [current, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  // Zoom follows the pointer: the point under the cursor stays under it.
  const track = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setZoomed(false);
          onIndexChange(null);
        }
      }}
      title={`${productName} — image ${current + 1} of ${images.length}`}
      hideTitle
      size="full"
    >
      <div className="relative flex h-full items-center justify-center bg-canvas">
        <button
          type="button"
          onClick={(event) => {
            track(event);
            setZoomed((value) => !value);
          }}
          onMouseMove={zoomed ? track : undefined}
          aria-label={zoomed ? "Zoom out" : "Zoom in"}
          className={cn(
            "aspect-[4/5] h-[min(100dvh,125vw)] max-w-full overflow-hidden",
            zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
          )}
        >
          <div
            className="h-full w-full transition-transform duration-300 ease-[var(--ease-out-expo)]"
            style={
              {
                transform: zoomed ? "scale(2)" : "none",
                transformOrigin: `${origin.x}% ${origin.y}%`,
              } as CSSProperties
            }
          >
            {images[current] && <ProductImage image={images[current]} sizes="100vw" />}
          </div>
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute start-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-canvas/80 rtl:rotate-180"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute end-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-canvas/80 rtl:rotate-180"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
            <p className="absolute start-1/2 bottom-4 -translate-x-1/2 label-caps tabular-nums">
              {current + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
