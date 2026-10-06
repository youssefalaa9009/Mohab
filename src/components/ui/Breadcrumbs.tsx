import { Link } from "react-router";
import { cn } from "@/lib/cn";

export type Crumb = { label: string; to: string };

/** Trail of links; the last crumb is the current page and is not a link. */
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 label-caps text-muted">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.to} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-ink">
                  {crumb.label}
                </span>
              ) : (
                <>
                  <Link to={crumb.to} className={cn("link-underline hover:text-ink")}>
                    {crumb.label}
                  </Link>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
