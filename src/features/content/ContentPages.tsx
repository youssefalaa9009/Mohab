import type { ReactNode } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { site } from "@/config/site";
import { Sparkle } from "@/components/brand/Brand";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { Meta } from "@/lib/seo";
import { ContentSection, ContentShell } from "./ContentShell";

/*
 * Copy on these pages is EXAMPLE CONTENT, written so the site reads as it will
 * at launch. Policies and timeframes come from config/site.ts; the rest is
 * here. QUATTRO replaces both before launch (README checklist). Statements the
 * shop itself guarantees — cash on delivery, the confirmation call, fees shown
 * at checkout, guest checkout, order tracking — describe how the site works.
 */

/* ─── About ───────────────────────────────────────────────────────────────── */

export function AboutPage() {
  const { brand, detail } = site.images.about;
  return (
    <main id="main" className="flex-1 pb-section">
      <ContentHead />
      <section
        id="story"
        aria-labelledby="about-story"
        className="container-page grid-page items-center gap-y-10 pt-section"
      >
        <div className="relative col-span-4 md:col-span-4 lg:col-span-5">
          <div className="aspect-square overflow-hidden">
            <ProductImage
              image={site.images.founders}
              sizes="(min-width: 64rem) 40vw, (min-width: 48rem) 50vw, 100vw"
              className="grayscale"
            />
          </div>
          <Sparkle className="absolute -start-3 -top-3 size-6 text-silver" />
          <Sparkle className="absolute -end-3 -bottom-3 size-6 text-silver" />
        </div>
        <div className="col-span-4 flex flex-col gap-6 md:col-span-4 lg:col-span-6 lg:col-start-7">
          <p className="flex items-center gap-2 label-caps text-muted">
            <Sparkle className="size-3 text-silver" />
            About us
          </p>
          <h2 id="about-story" className="font-display text-h1">
            {site.story.headline.join(" ")}
          </h2>
          <p className="text-muted">{site.story.body}</p>
          <p className="text-muted">{site.story.more}</p>
          <p className="font-display text-h3 italic">{site.story.signoff}</p>
        </div>
      </section>
      <section className="container-page pt-section">
        <div className="relative aspect-[4/5] overflow-hidden md:aspect-[21/9]">
          <ProductImage image={brand} decorative sizes="100vw" className="object-[50%_30%]" />
          <div className="absolute inset-0 bg-linear-to-t from-night/70 to-transparent" />
          <p className="absolute start-6 bottom-6 max-w-[20ch] font-display text-h2 text-bone md:start-10 md:bottom-10">
            {site.manifesto.slice(2).join(". ")}.
          </p>
        </div>
      </section>
      <section className="container-page grid-page gap-y-10 pt-section">
        <div className="col-span-4 flex flex-col justify-center gap-6 md:col-span-4 lg:col-span-5">
          <h2 className="font-display text-h2">Fabric first</h2>
          <p className="text-muted">
            Heavyweight cotton jersey that holds its shape, loopback fleece that softens with every
            wash, and linen blends that breathe through an Egyptian summer. We choose the cloth
            before we draw the cut.
          </p>
          <p className="text-muted">
            Pieces are cut and sewn in small workshops we visit in person, with reinforced seams and
            finishing you can feel on the inside of the garment.
          </p>
        </div>
        <div className="col-span-4 aspect-[3/2] overflow-hidden md:col-span-4 lg:col-span-6 lg:col-start-7">
          <ProductImage image={detail} sizes="(min-width: 64rem) 50vw, 100vw" />
        </div>
      </section>
      <section className="container-page pt-section text-center">
        <Link to="/shop" className={buttonClassName({ variant: "secondary" })}>
          Explore the collection
        </Link>
      </section>
    </main>
  );
}

function ContentHead() {
  return (
    <div className="container-page pt-8 lg:pt-12">
      <Meta title="About" />
      <p className="label-caps text-muted">About</p>
      <h1 className="mt-6 max-w-5xl font-display text-h1">{site.headline}</h1>
      <p className="mt-8 max-w-[52ch] text-muted md:text-[1.125rem]">{site.statement}</p>
    </div>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────────────────────── */

type Faq = { q: string; a: ReactNode };

const FAQ_GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Orders & payment",
    items: [
      {
        q: "How can I pay?",
        a: "Cash on delivery: you pay in cash when your order arrives.",
      },
      {
        q: "Will you contact me after I order?",
        a: "Yes. We call the mobile number you gave at checkout to confirm your order before it ships.",
      },
      {
        q: "Do I need an account to order?",
        a: (
          <>
            No — you can check out as a guest. An <Link to="/account/register">account</Link> saves
            your address and keeps your order history in one place.
          </>
        ),
      },
      {
        q: "Can I change or cancel my order?",
        a: "Yes, until it ships. Tell us on the confirmation call, or contact us with your order number and we'll update or cancel it.",
      },
    ],
  },
  {
    title: "Delivery",
    items: [
      {
        q: "Where do you deliver?",
        a: site.policies.shipping,
      },
      {
        q: "How much is delivery?",
        a: "Delivery options and their prices for your governorate are shown at checkout, before you place your order.",
      },
      {
        q: "How long does delivery take?",
        a: site.policies.shippingSummary,
      },
      {
        q: "How do I track my order?",
        a: (
          <>
            Use <Link to="/help/track-order">Track order</Link> with your order number and the
            mobile number you ordered with. If you have an account, your orders are also under
            Account → Orders.
          </>
        ),
      },
    ],
  },
  {
    title: "Returns & exchanges",
    items: [
      { q: "Can I return an item?", a: site.policies.returns },
      { q: "Can I exchange for another size?", a: site.policies.exchanges },
      { q: "When will I get my refund?", a: site.policies.refunds },
    ],
  },
  {
    title: "Sizing & care",
    items: [
      {
        q: "How do I find my size?",
        a: "Products with a size chart have a Size guide link next to the size options. Our tees and hoodies are cut relaxed; if you're between sizes, take your usual size for a clean fit or size up for an oversized one.",
      },
      {
        q: "How should I care for my pieces?",
        a: "Wash cold, inside out, with similar colours, and dry flat or on a line. Skip the tumble dryer: it shortens the life of cotton and fleece. Each product page lists its own care instructions.",
      },
    ],
  },
];

export function FaqPage() {
  return (
    <ContentShell
      title="FAQ"
      eyebrow="Help"
      description="Answers about ordering, cash on delivery, delivery, returns and sizing at QUATTRO."
      intro={
        <>
          Can’t find what you need?{" "}
          <Link to="/contact" className="text-ink underline">
            Contact us
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-12">
        {FAQ_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 font-display text-h3">{group.title}</h2>
            {/*
              Native <details>: opens before hydration and without JavaScript, and
              the answers stay in the HTML for search engines.
            */}
            <div className="border-t border-line">
              {group.items.map((item) => (
                <details key={item.q} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 label-caps transition-colors hover:text-muted [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Plus
                      aria-hidden
                      className="size-4 shrink-0 transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                    />
                  </summary>
                  <div className="pb-6 text-muted [&_a]:text-ink [&_a]:underline">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ContentShell>
  );
}

/* ─── Shipping & returns ──────────────────────────────────────────────────── */

export function ShippingPage() {
  return (
    <ContentShell title="Shipping" eyebrow="Help">
      <ContentSection title="Delivery areas and times">
        <p>{site.policies.shipping}</p>
      </ContentSection>
      <ContentSection title="Delivery fees">
        <p>
          The delivery options for your governorate, and their prices, are shown at checkout before
          you place your order.
        </p>
      </ContentSection>
      <ContentSection title="Confirmation and payment">
        <p>
          After you order, we call the mobile number you gave to confirm before it ships. You pay in
          cash when your order arrives.
        </p>
      </ContentSection>
      <ContentSection title="Tracking">
        <p>
          <Link to="/help/track-order">Track your order</Link> with its number and your mobile
          number.
        </p>
      </ContentSection>
    </ContentShell>
  );
}

export function ReturnsPage() {
  return (
    <ContentShell title="Returns & exchanges" eyebrow="Help">
      <ContentSection title="Returns">
        <p>{site.policies.returns}</p>
      </ContentSection>
      <ContentSection title="Exchanges">
        <p>{site.policies.exchanges}</p>
      </ContentSection>
      <ContentSection title="How to start a return">
        <ol className="list-decimal ps-5">
          <li>Contact us within 14 days of delivery with your order number.</li>
          <li>Pack the piece unworn, with its tags, in its original bag.</li>
          <li>Our courier collects it from your address.</li>
          <li>{site.policies.refunds}</li>
        </ol>
        <p>
          Questions? <Link to="/contact">Contact us</Link> with your order number.
        </p>
      </ContentSection>
    </ContentShell>
  );
}

/* ─── Legal ───────────────────────────────────────────────────────────────── */

const LEGAL_NOTICE = (
  <p className="border border-line-strong px-4 py-3 text-small text-ink">
    Example text for review. Have this page written or checked by a lawyer before launch.
  </p>
);

export function PrivacyPage() {
  return (
    <ContentShell title="Privacy policy" eyebrow="Legal">
      {LEGAL_NOTICE}
      <ContentSection title="What we collect">
        <p>
          To deliver an order we ask for your name, mobile number, delivery address and, optionally,
          your email. Accounts also store your email and password (hashed, never readable).
        </p>
        <p>
          If you subscribe to the newsletter we keep your email address and the date you agreed.
          When you contact us we keep your message so we can answer it.
        </p>
      </ContentSection>
      <ContentSection title="How we use it">
        <p>
          To deliver your order, contact you about it, answer your questions and, only if you ask
          for it, send the newsletter. We don't sell your data or use it for advertising.
        </p>
      </ContentSection>
      <ContentSection title="Who we share it with">
        <p>
          Our delivery partner receives your name, phone number and address to bring your order. Our
          email provider sends order emails on our behalf. Nobody else receives your data.
        </p>
      </ContentSection>
      <ContentSection title="Your rights">
        <p>
          You can see and correct your details in your account at any time. To have your data
          deleted, contact us; we keep only what we must for accounting.
        </p>
      </ContentSection>
      <ContentSection title="Contact">
        <p>{site.contact.email}</p>
      </ContentSection>
    </ContentShell>
  );
}

export function TermsPage() {
  return (
    <ContentShell title="Terms & conditions" eyebrow="Legal">
      {LEGAL_NOTICE}
      <ContentSection title="Orders">
        <p>
          Placing an order is an offer to buy. It is accepted when we confirm it — by phone for cash
          on delivery, or once your InstaPay payment is verified.
        </p>
      </ContentSection>
      <ContentSection title="Prices and payment">
        <p>
          Prices are in Egyptian pounds and include VAT. Delivery is shown separately at checkout.
          If a price is listed in error, we'll contact you before confirming the order.
        </p>
      </ContentSection>
      <ContentSection title="Delivery">
        <p>{site.policies.shipping}</p>
      </ContentSection>
      <ContentSection title="Returns">
        <p>{site.policies.returns}</p>
      </ContentSection>
      <ContentSection title="Business details">
        <p>
          QUATTRO (example business name) · {site.contact.address} · Commercial registration no.
          000000 (example).
        </p>
      </ContentSection>
    </ContentShell>
  );
}

/** Factual list of what the shop stores in the browser — update when that changes. */
const STORAGE: { name: string; kind: string; purpose: string; lasts: string }[] = [
  { name: "quattro_cart", kind: "Cookie", purpose: "Keeps your bag", lasts: "60 days" },
  {
    name: "quattro.session_token",
    kind: "Cookie",
    purpose: "Keeps you signed in (accounts only)",
    lasts: "30 days, or until you sign out",
  },
  {
    name: "quattro:wishlist",
    kind: "Local storage",
    purpose: "Your wishlist while signed out",
    lasts: "Until you clear it",
  },
  {
    name: "quattro:recently-viewed",
    kind: "Local storage",
    purpose: "Recently viewed products",
    lasts: "Until you clear it",
  },
  {
    name: "quattro:recent-searches",
    kind: "Local storage",
    purpose: "Your recent searches",
    lasts: "Until you clear it",
  },
];

export function CookiesPage() {
  return (
    <ContentShell title="Cookie policy" eyebrow="Legal">
      {LEGAL_NOTICE}
      <ContentSection title="What this site stores">
        <p>
          These are needed for the shop to work. They are not used for advertising, and nothing here
          tracks you across other websites.
        </p>
        {/* Focusable, so keyboard users can scroll it on narrow screens. */}
        <div
          role="region"
          aria-label="Cookies and storage"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[32rem] text-start text-small">
            <thead>
              <tr className="border-b border-line-strong text-ink">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  Name
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  Type
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  Purpose
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  Kept for
                </th>
              </tr>
            </thead>
            <tbody>
              {STORAGE.map((row) => (
                <tr key={row.name} className="border-b border-line">
                  <td className="py-2 pe-4 font-mono text-caption text-ink">{row.name}</td>
                  <td className="py-2 pe-4">{row.kind}</td>
                  <td className="py-2 pe-4">{row.purpose}</td>
                  <td className="py-2">{row.lasts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentSection>
      <ContentSection title="Analytics">
        <p>
          If analytics is switched on, it uses Umami, which sets no cookies and records pages
          visited and shop events (such as adding to the bag) without identifying you.
        </p>
        <p>When enabled, analytics runs on QUATTRO's own server, and the data stays with us.</p>
      </ContentSection>
    </ContentShell>
  );
}
