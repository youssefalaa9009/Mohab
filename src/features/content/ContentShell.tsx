import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/cn";
import { Meta } from "@/lib/seo";

/** Shared frame for help, policy and brand pages: breadcrumb, heading, readable measure. */
export function ContentShell({
  title,
  eyebrow,
  intro,
  description,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  description?: string;
  children: ReactNode;
  /** Full grid width instead of a reading column (forms beside details). */
  wide?: boolean;
}) {
  const { pathname } = useLocation();
  return (
    <main id="main" className="container-page flex-1 pt-8 pb-section lg:pt-12">
      <Meta title={title} description={description} />
      <Breadcrumbs
        crumbs={[
          { label: "Home", to: "/" },
          { label: title, to: pathname },
        ]}
      />
      <header className="mt-8 max-w-3xl lg:mt-12">
        {eyebrow && <p className="label-caps text-muted">{eyebrow}</p>}
        <h1 className="mt-3 font-display text-h1">{title}</h1>
        {intro && <div className="mt-6 text-body text-muted md:text-[1.125rem]">{intro}</div>}
      </header>
      <div className={cn("mt-12 lg:mt-16", !wide && "max-w-[68ch]")}>{children}</div>
    </main>
  );
}

/** A titled block of body copy inside a content page. */
export function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="font-display text-h3">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-body text-muted [&_a]:text-ink [&_a]:underline">
        {children}
      </div>
    </section>
  );
}
