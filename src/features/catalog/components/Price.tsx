import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { Money } from "../types";

/**
 * Price. On sale: the sale price in red with the saving as a percentage, and
 * the original price struck through on the line below.
 */
export function Price({
  price,
  compareAtPrice,
  className,
}: {
  price: Money;
  compareAtPrice?: Money | null;
  className?: string;
}) {
  const onSale = compareAtPrice != null && compareAtPrice.amount > price.amount;
  if (!onSale) {
    return <p className={cn("tabular-nums", className)}>{formatMoney(price)}</p>;
  }
  const percentOff = Math.round(
    ((compareAtPrice.amount - price.amount) / compareAtPrice.amount) * 100,
  );
  return (
    <div className={cn("flex flex-col tabular-nums", className)}>
      <p className="font-medium text-danger">
        <span className="sr-only">Sale price </span>
        {formatMoney(price)} <span className="whitespace-nowrap">({percentOff}% off)</span>
      </p>
      <p className="text-muted">
        <span className="sr-only">Was </span>
        <s>{formatMoney(compareAtPrice)}</s>
      </p>
    </div>
  );
}
