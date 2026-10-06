import { m } from "motion/react";
import type { ElementType, ReactNode } from "react";

/**
 * Props are deliberately narrow rather than extending the full set of HTML
 * attributes: Motion redefines several DOM handlers (onDrag, onAnimationStart)
 * with its own signatures, so spreading them in conflicts.
 */
type RevealProps = {
  children: ReactNode;
  /** Seconds to wait before the reveal starts — use to stagger siblings. */
  delay?: number;
  /** Distance travelled, in pixels. */
  distance?: number;
  as?: ElementType;
  className?: string;
  id?: string;
};

/**
 * Fades and lifts an element into view the first time it is scrolled to.
 *
 * `strict` LazyMotion means only `m.*` components may be used here.
 *
 * Reduced motion is handled in CSS (`[data-reveal]` is forced visible), never
 * by branching here: the server can't know the preference, so rendering
 * different markup in the browser would break hydration.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 24,
  as = "div",
  className,
  id,
}: RevealProps) {
  const Component = m[as as "div"] ?? m.div;

  return (
    <Component
      className={className}
      id={id}
      data-reveal=""
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}

/**
 * Reveals a heading line by line. Each line sits in a clipping box and slides
 * up from below it, so the text appears to rise out of the page.
 *
 * Takes an array of lines rather than splitting a string, so the line breaks
 * are deliberate and the markup stays one heading element for screen readers.
 */
export function LineReveal({
  lines,
  as: Heading = "h2",
  className,
  lineClassName,
  delay = 0,
}: {
  lines: string[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  delay?: number;
}) {
  return (
    <Heading className={className}>
      {lines.map((line, index) => (
        /*
         * The viewport is watched on the clipping wrapper, not on the line
         * itself. IntersectionObserver subtracts clipping by ancestors, and
         * the line starts translated fully outside this box — so observing it
         * directly would report zero intersection and it would never animate.
         * The wrapper is unclipped, so it triggers reliably and passes the
         * variant down to the line.
         */
        <m.span
          key={line}
          className="block overflow-hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        >
          <m.span
            className={`block ${lineClassName ?? ""}`}
            data-reveal=""
            // Opacity rides along so the line still appears under reduced
            // motion, where Motion skips transforms.
            variants={{
              hidden: { y: "110%", opacity: 0 },
              visible: { y: "0%", opacity: 1 },
            }}
            transition={{
              duration: 0.9,
              delay: delay + index * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {line}
          </m.span>
        </m.span>
      ))}
    </Heading>
  );
}
