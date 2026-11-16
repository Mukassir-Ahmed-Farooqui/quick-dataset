import type { Transition, Variants } from 'framer-motion'

/** Mindcase-style easing: cubic-bezier(0, 0, .2, 1). Keep everything 150–250ms. */
export const ease = [0, 0, 0.2, 1] as const
export const fast: Transition = { duration: 0.18, ease }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15, ease } },
}

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
}

export const collapse: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.2, ease } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.15, ease } },
}
