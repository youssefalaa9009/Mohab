import type { ReactNode } from "react";
import { LineReveal, Reveal } from "@/components/motion/Reveal";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

/**
 * Living reference for the QUATTRO design system — the Phase 1 review surface.
 * Not linked from the storefront and marked noindex.
 */
export function DesignSystemPage() {
  return (
    <main id="main" className="flex-1">
      <title>Design system · QUATTRO</title>
      <meta name="robots" content="noindex" />

      <header className="container-page border-b border-line py-16 lg:py-24">
        <p className="label-caps text-muted">Phase 1 · Foundation</p>
        <LineReveal
          as="h1"
          lines={["Design", "system"]}
          className="mt-6 font-display text-display"
        />
        <p className="mt-8 max-w-[52ch] text-muted">
          Provisional until QUATTRO&rsquo;s logo, brand colours and photography arrive. Every value
          below is a token in <code className="font-mono text-small">src/styles/globals.css</code> —
          change it there and it changes everywhere.
        </p>
      </header>

      <Section number="01" title="Colour">
        <p className="mb-8 max-w-[52ch] text-muted">
          A warm, paper-like neutral range so photography carries the colour. Text tones meet WCAG
          AA on the canvas background.
        </p>
        <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
          <Swatch name="Canvas" token="--color-canvas" className="bg-canvas" />
          <Swatch name="Surface" token="--color-surface" className="bg-surface" />
          <Swatch name="Ink" token="--color-ink" className="bg-ink" dark />
          <Swatch name="Ink soft" token="--color-ink-soft" className="bg-ink-soft" dark />
          <Swatch name="Muted" token="--color-muted" className="bg-muted" dark />
          <Swatch name="Line" token="--color-line" className="bg-line" />
          <Swatch name="Line strong" token="--color-line-strong" className="bg-line-strong" dark />
          <Swatch name="Success" token="--color-success" className="bg-success" dark />
          <Swatch name="Warning" token="--color-warning" className="bg-warning" dark />
          <Swatch name="Danger" token="--color-danger" className="bg-danger" dark />
        </ul>
        <p className="mt-6 text-caption text-muted">
          Accent colour is deliberately unset — it comes from the brand palette.
        </p>
      </Section>

      <Section number="02" title="Typography">
        <div className="flex flex-col gap-10">
          <Specimen label="Display · Bodoni Moda, optical size 96">
            <p className="font-display text-display">QUATTRO</p>
          </Specimen>
          <Specimen label="H1 · Bodoni Moda">
            <p className="font-display text-h1">Autumn in four parts</p>
          </Specimen>
          <Specimen label="H2 · Bodoni Moda italic">
            <p className="font-display text-h2 italic">The tailoring edit</p>
          </Specimen>
          <Specimen label="H3 · Instrument Sans 500">
            <p className="text-h3 font-medium">Oversized wool coat</p>
          </Specimen>
          <Specimen label="Body · Instrument Sans">
            <p className="max-w-[60ch] text-body">
              Cut from a mid-weight wool blend with a softly structured shoulder. The body text size
              holds a comfortable measure of roughly sixty characters.
            </p>
          </Specimen>
          <Specimen label="Caption / label · condensed uppercase, tabular figures">
            <p className="label-caps">Add to bag · EGP 1,250 · Size M</p>
          </Specimen>
        </div>
      </Section>

      <Section number="03" title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Add to bag</Button>
          <Button variant="secondary">Size guide</Button>
          <Button variant="ghost">Clear filters</Button>
          <Button loading>Add to bag</Button>
          <Button disabled>Sold out</Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button size="lg">Shop the collection</Button>
          <Button size="lg" variant="secondary">
            Explore new arrivals
          </Button>
        </div>
        <p className="mt-6 text-caption text-muted">
          The loading state keeps the button&rsquo;s width, so layouts never jump.
        </p>
      </Section>

      <Section number="04" title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>New</Badge>
          <Badge tone="sale">Sale</Badge>
          <Badge tone="soldOut">Sold out</Badge>
        </div>
      </Section>

      <Section number="05" title="Form controls">
        <div className="grid max-w-xl gap-6">
          <Field label="Full name">
            <Input name="name" placeholder="Nour Hassan" autoComplete="name" />
          </Field>
          <Field label="Email address" description="Order updates are sent here.">
            <Input type="email" name="email" placeholder="you@example.com" />
          </Field>
          <Field label="Message">
            <Textarea name="message" placeholder="How can we help?" />
          </Field>
        </div>
        <p className="mt-6 text-caption text-muted">
          Labels are always visible; errors are announced to screen readers through Base UI.
        </p>
      </Section>

      <Section number="06" title="Accordion">
        <Accordion className="max-w-2xl">
          <AccordionItem title="Description">Product description copy sits here.</AccordionItem>
          <AccordionItem title="Materials &amp; care">Material and care details.</AccordionItem>
          <AccordionItem title="Shipping &amp; returns">
            Delivery and returns summary.
          </AccordionItem>
        </Accordion>
      </Section>

      <Section number="07" title="Grid &amp; spacing">
        <p className="mb-6 max-w-[52ch] text-muted">
          Four columns on mobile, eight on tablet, twelve on desktop.
        </p>
        <div className="grid-page">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={`h-20 bg-stone-1 ${i >= 4 ? "hidden md:block" : ""} ${i >= 8 ? "md:hidden lg:block" : ""}`}
            />
          ))}
        </div>
      </Section>

      <Section number="08" title="Motion">
        <p className="mb-8 max-w-[52ch] text-muted">
          Reveals use transform and opacity only. With the system&rsquo;s reduce-motion setting on,
          content appears immediately instead of being hidden.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Reveal key={i} delay={i * 0.08} className="border border-line bg-surface p-8">
              <p className="label-caps text-muted">Reveal</p>
              <p className="mt-2 font-display text-h3">Step {i + 1}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section number="09" title="Product image ratio">
        <p className="mb-6 max-w-[52ch] text-muted">
          Every product image is 4:5, so grids never shift while loading.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Written out in full: Tailwind scans source text, so `bg-${tone}` would not build. */}
          {["bg-stone-1", "bg-stone-2", "bg-stone-3", "bg-stone-4"].map((tone, i) => (
            <figure key={tone}>
              <div className={`aspect-[4/5] w-full ${tone}`} />
              <figcaption className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-small">Demo Product {String(i + 1).padStart(2, "0")}</span>
                <span className="label-caps text-muted">EGP [—]</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-caption text-muted">
          Placeholder tones stand in until real photography is supplied.
        </p>
      </Section>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="container-page border-b border-line py-16 lg:py-24">
      <div className="mb-10 flex items-baseline gap-4">
        <span className="label-caps text-muted">{number}</span>
        <h2 className="font-display text-h2">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  token,
  className,
  dark = false,
}: {
  name: string;
  token: string;
  className: string;
  dark?: boolean;
}) {
  return (
    <li className={`flex min-h-28 flex-col justify-end p-4 ${className}`}>
      <span className={`label-caps ${dark ? "text-paper" : "text-ink"}`}>{name}</span>
      <code className={`text-caption ${dark ? "text-paper/70" : "text-muted"}`}>{token}</code>
    </li>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-5">
      <p className="mb-4 label-caps text-muted">{label}</p>
      {children}
    </div>
  );
}
