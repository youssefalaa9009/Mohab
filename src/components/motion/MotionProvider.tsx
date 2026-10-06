import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Loads only Motion's DOM animation features (~5 kB) instead of the full bundle,
 * and defers to the OS "reduce motion" setting: with `reducedMotion="user"`,
 * Motion drops transform/layout animation and keeps opacity, so content still
 * appears rather than staying hidden.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
