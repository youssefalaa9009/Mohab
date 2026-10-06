import { X } from "lucide-react";
import { useId, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { Facets } from "../types";
import {
  clearRefinements,
  hasRefinements,
  setParam,
  toggleValue,
  type MultiKey,
  type ShopState,
} from "./shop-params";

type FilterPanelProps = {
  facets: Facets;
  state: ShopState;
  /** Hidden on category pages, where the category is already fixed. */
  showCategories: boolean;
};

function useApply() {
  const [params, setParams] = useSearchParams();
  // Filtering must not jump the page back to the top.
  const apply = (next: URLSearchParams) => setParams(next, { preventScrollReset: true });
  return { params, apply };
}

export function FilterPanel({ facets, state, showCategories }: FilterPanelProps) {
  const { params, apply } = useApply();
  const toggle = (key: MultiKey, value: string) => apply(toggleValue(params, key, value));

  const groups = [
    showCategories && facets.categories.length > 1 && "category",
    facets.sizes.length > 0 && "size",
    facets.colors.length > 0 && "color",
    facets.price && "price",
    "availability",
  ].filter(Boolean) as string[];

  return (
    <Accordion multiple defaultValue={groups}>
      {groups.includes("category") && (
        <AccordionItem value="category" title="Category">
          <OptionList>
            {facets.categories.map((option) => (
              <CheckboxOption
                key={option.value}
                label={option.label}
                count={option.count}
                checked={state.categories.includes(option.value)}
                onChange={() => toggle("category", option.value)}
              />
            ))}
          </OptionList>
        </AccordionItem>
      )}

      {groups.includes("size") && (
        <AccordionItem value="size" title="Size">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Size">
            {facets.sizes.map((option) => {
              const checked = state.sizes.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggle("size", option.value)}
                  className={cn(
                    "h-10 min-w-12 border px-3 label-caps transition-colors",
                    checked
                      ? "border-ink bg-ink text-paper"
                      : "border-line-strong hover:border-ink",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </AccordionItem>
      )}

      {groups.includes("color") && (
        <AccordionItem value="color" title="Colour">
          <OptionList>
            {facets.colors.map((option) => (
              <CheckboxOption
                key={option.value}
                label={option.label}
                count={option.count}
                swatch={option.hex ?? null}
                checked={state.colors.includes(option.value)}
                onChange={() => toggle("color", option.value)}
              />
            ))}
          </OptionList>
        </AccordionItem>
      )}

      {groups.includes("price") && facets.price && (
        <AccordionItem value="price" title="Price">
          <PriceRange
            key={`${state.minPrice}-${state.maxPrice}`}
            bounds={facets.price}
            state={state}
            onApply={(min, max) =>
              apply(setParam(setParam(params, "minPrice", min), "maxPrice", max))
            }
          />
        </AccordionItem>
      )}

      <AccordionItem value="availability" title="Availability">
        <OptionList>
          <CheckboxOption
            label="In stock only"
            checked={state.inStock}
            onChange={() => apply(setParam(params, "inStock", state.inStock ? null : "1"))}
          />
        </OptionList>
      </AccordionItem>
    </Accordion>
  );
}

function OptionList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1">{children}</ul>;
}

function CheckboxOption({
  label,
  count,
  swatch,
  checked,
  onChange,
}: {
  label: string;
  count?: number | undefined;
  swatch?: string | null;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <li>
      <label className="flex min-h-10 cursor-pointer items-center gap-3 text-small text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer size-4 shrink-0 cursor-pointer appearance-none rounded-input border border-line-strong bg-surface checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
        {swatch !== undefined && (
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full border border-line-strong"
            style={{ backgroundColor: swatch ?? "transparent" }}
          />
        )}
        <span className="flex-1">{label}</span>
        {count !== undefined && <span className="text-muted tabular-nums">{count}</span>}
      </label>
    </li>
  );
}

function PriceRange({
  bounds,
  state,
  onApply,
}: {
  bounds: { min: number; max: number };
  state: ShopState;
  onApply: (min: string | null, max: string | null) => void;
}) {
  const id = useId();
  const currency = "EGP";
  const lowest = Math.floor(bounds.min / 100);
  const highest = Math.ceil(bounds.max / 100);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? null : String(Math.max(0, Math.round(Number(value))));
    };
    let min = read("min");
    let max = read("max");
    // Tolerate a reversed range instead of returning nothing.
    if (min !== null && max !== null && Number(min) > Number(max)) [min, max] = [max, min];
    onApply(min, max);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-caption text-muted">
        {formatMoney({ amount: lowest * 100, currency })} –{" "}
        {formatMoney({ amount: highest * 100, currency })}
      </p>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1" htmlFor={`${id}-min`}>
          <span className="label-caps text-muted">Min ({currency})</span>
          <input
            id={`${id}-min`}
            name="min"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={state.minPrice ?? ""}
            placeholder={String(lowest)}
            className="h-10 w-full rounded-input border border-line-strong bg-surface px-3 text-small focus:border-ink focus:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1" htmlFor={`${id}-max`}>
          <span className="label-caps text-muted">Max ({currency})</span>
          <input
            id={`${id}-max`}
            name="max"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={state.maxPrice ?? ""}
            placeholder={String(highest)}
            className="h-10 w-full rounded-input border border-line-strong bg-surface px-3 text-small focus:border-ink focus:outline-none"
          />
        </label>
      </div>
      <Button type="submit" variant="secondary" className="h-10">
        Apply
      </Button>
    </form>
  );
}

/** Removable chips for every active refinement, plus "Clear all". */
export function ActiveFilters({ facets, state }: { facets: Facets; state: ShopState }) {
  const { params, apply } = useApply();
  if (!hasRefinements({ ...state, sort: null })) return null;

  const label = (key: "categories" | "colors", value: string) =>
    facets[key].find((option) => option.value === value)?.label ?? value;

  const chips: { key: string; text: string; remove: () => void }[] = [
    ...state.categories.map((value) => ({
      key: `category-${value}`,
      text: label("categories", value),
      remove: () => apply(toggleValue(params, "category", value)),
    })),
    ...state.sizes.map((value) => ({
      key: `size-${value}`,
      text: `Size ${value}`,
      remove: () => apply(toggleValue(params, "size", value)),
    })),
    ...state.colors.map((value) => ({
      key: `color-${value}`,
      text: label("colors", value),
      remove: () => apply(toggleValue(params, "color", value)),
    })),
  ];
  if (state.minPrice !== null || state.maxPrice !== null) {
    chips.push({
      key: "price",
      text: `${state.minPrice ?? 0} – ${state.maxPrice ?? "∞"} EGP`,
      remove: () => apply(setParam(setParam(params, "minPrice", null), "maxPrice", null)),
    });
  }
  if (state.inStock) {
    chips.push({
      key: "stock",
      text: "In stock",
      remove: () => apply(setParam(params, "inStock", null)),
    });
  }

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={chip.remove}
            className="inline-flex h-8 items-center gap-2 border border-line-strong px-3 text-caption hover:border-ink"
          >
            {chip.text}
            <X aria-hidden className="size-3" />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => apply(clearRefinements(params))}
          className="link-underline ms-1 label-caps"
        >
          Clear all
        </button>
      </li>
    </ul>
  );
}
