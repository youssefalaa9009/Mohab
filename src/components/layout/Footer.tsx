import { Link } from "react-router";
import type { NavData } from "@/features/catalog/types";
import { NewsletterForm } from "./NewsletterForm";
import { Logo } from "@/components/brand/Brand";
import { site } from "@/config/site";
import { footerNav } from "./nav-items";

/** Shown only once a URL is set in config/site.ts. */
const SOCIAL = [
  ["Instagram", site.social.instagram],
  ["TikTok", site.social.tiktok],
  ["Facebook", site.social.facebook],
] as const;

export function Footer({ nav, minimal = false }: { nav: NavData | null; minimal?: boolean }) {
  if (minimal) {
    return (
      <footer className="mt-auto border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-6 label-caps text-muted">
          <span>© {new Date().getFullYear()} QUATTRO</span>
          <span className="flex gap-6">
            <Link to="/legal/privacy" className="link-underline">
              Privacy
            </Link>
            <Link to="/legal/terms" className="link-underline">
              Terms
            </Link>
            <Link to="/contact" className="link-underline">
              Help
            </Link>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer data-surface="dark" className="mt-auto border-t border-line bg-night text-bone">
      <div id="site-links" className="container-page py-16 lg:py-24">
        <div className="grid-page gap-y-12">
          <div className="col-span-4 md:col-span-8 lg:col-span-4">
            <p>
              <span className="sr-only">QUATTRO</span>
              <Logo className="h-24" />
            </p>
            <p className="mt-4 max-w-[34ch] text-small text-bone/70">{site.statement}</p>
          </div>

          {footerNav(nav).map((group) => {
            // aria-labelledby takes a space-separated id list, so ids must not contain spaces.
            const headingId = `footer-${group.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <nav
                key={group.heading}
                aria-labelledby={headingId}
                className="col-span-2 md:col-span-3 lg:col-span-2"
              >
                <h2 id={headingId} className="label-caps text-bone/60">
                  {group.heading}
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link to={item.to} className="link-underline text-small">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}

          <div className="col-span-4 md:col-span-8 lg:col-span-2">
            <h2 className="label-caps text-bone/60">Newsletter</h2>
            <p className="mt-5 text-small text-bone/70">
              New collections and early access, no more than twice a month.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-bone/15 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="label-caps text-bone/50">
            © {new Date().getFullYear()} QUATTRO. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="label-caps text-bone/50">{site.paymentMethods.join(" · ")}</span>
            {SOCIAL.filter(([, url]) => url).map(([label, url]) => (
              <a
                key={label}
                href={url!}
                target="_blank"
                rel="noreferrer"
                className="link-underline label-caps text-bone/70"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
